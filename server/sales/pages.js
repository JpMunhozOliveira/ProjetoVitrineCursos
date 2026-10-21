// Gravação e leitura das páginas de vendas (usado pela API do painel, pela rota pública
// /p/:slug, pela pré-visualização e pelo script de importação).
//
// Duas versões por página:
//   RASCUNHO  (sections, theme)  -> o que o editor salva
//   PUBLICADA (published_*)      -> o que o público vê
// "Publicar" copia o rascunho para a versão publicada. Salvar nunca muda o site.
// Título e descrição para buscadores (título e resumo do produto) e marca vêm do PRODUTO (tela
// "Editar produto") e valem assim que ele é salvo.
const pool = require("../config/database");
const storage = require("../lib/storage");
const { validateSections, validBlocks, mediaIds, sharedIds } = require("./blocks");

// Blocos válidos de uma lista gravada (os inválidos são ignorados um a um, ver validBlocks).
const storedBlocks = (sections) => validBlocks(sections).map((x) => x.block);
const { normalizeTheme, ThemeError } = require("./theme");

// has_unpublished_changes: o rascunho difere do que está publicado (ou nunca foi publicado).
const PAGE_COLUMNS = `id, product_id, sections, theme, published_at, created_at, updated_at,
  (published_sections IS DISTINCT FROM sections OR published_theme IS DISTINCT FROM theme) AS has_unpublished_changes`;

// Dados do produto que a página usa (preço, checkout, título, resumo e marca vêm sempre do cadastro).
const PRODUCT_COLUMNS = `p.id, p.title, p.slug, p.short_description, p.price_cents, p.checkout_url, p.image_id, p.status,
  p.brand_name, p.brand_logo_id`;

class PageInputError extends Error {}

// Paleta pronta: guarda só o nome (ajustes na paleta valem para todas as páginas que a usam).
// Personalizada: guarda as duas cores. Erros de cor viram mensagem para o painel.
function storedTheme(input) {
  try {
    const theme = normalizeTheme(input);
    return theme.preset === "custom" ? theme : { preset: theme.preset };
  } catch (error) {
    if (error instanceof ThemeError) throw new PageInputError(error.message);
    throw error;
  }
}

function normalizeInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PageInputError("Envie um objeto JSON.");
  const allowed = ["sections", "theme"];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new PageInputError(`Campo(s) não suportado(s): ${unknown.join(", ")}.`);

  const { sections, error } = validateSections(body.sections ?? []);
  if (error) throw new PageInputError(error);
  return {
    sections,
    theme: storedTheme(body.theme),
  };
}

// Imagens usadas na página = as do rascunho + as da versão publicada (ambas precisam existir:
// uma é editada, a outra está no ar). O banco recusa excluir qualquer uma delas.
async function syncPageMedia(client, pageId) {
  const { rows } = await client.query("SELECT sections, published_sections FROM sales_pages WHERE id = $1", [pageId]);
  // Bloco a bloco: um bloco antigo inválido não pode "esconder" as imagens dos outros (elas
  // ficariam sem registro de uso e poderiam ser excluídas com a página no ar).
  const ids = new Set(mediaIds(storedBlocks(rows[0].sections)));
  mediaIds(storedBlocks(rows[0].published_sections)).forEach((id) => ids.add(id));
  await client.query("DELETE FROM sales_page_media WHERE sales_page_id = $1", [pageId]);
  if (ids.size) {
    await client.query("INSERT INTO sales_page_media (sales_page_id, media_id) SELECT $1, unnest($2::uuid[])", [pageId, [...ids]]);
  }

  // Blocos salvos usados (rascunho + publicada): o banco recusa excluir um bloco salvo em uso.
  const shared = new Set([...sharedIds(storedBlocks(rows[0].sections)), ...sharedIds(storedBlocks(rows[0].published_sections))]);
  await client.query("DELETE FROM sales_page_shared_blocks WHERE sales_page_id = $1", [pageId]);
  if (shared.size) {
    await client.query("INSERT INTO sales_page_shared_blocks (sales_page_id, shared_block_id) SELECT $1, unnest($2::uuid[])", [pageId, [...shared]]);
  }
}

// Troca cada referência a bloco salvo pelo conteúdo dele (mais os campos locais da página, como
// o fundo). Devolve { sections, shared }: shared = Map posição -> { id, name } dos blocos que vieram
// de um bloco salvo (no editor, eles aparecem trancados). Referência a bloco que não existe:
// "strict" (pré-visualização do editor) avisa; na página pública o bloco só some.
async function resolveShared(sections, { strict = false } = {}) {
  const list = Array.isArray(sections) ? sections : [];
  const ids = sharedIds(storedBlocks(list));
  const shared = new Map();
  if (!ids.length) return { sections: list, shared };
  const { rows } = await pool.query("SELECT id, name, type, data FROM shared_blocks WHERE id = ANY($1::uuid[])", [ids]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = list.map((block, index) => {
    if (!block || typeof block.shared !== "string") return block;
    const saved = byId.get(block.shared.toLowerCase());
    if (!saved || saved.type !== block.type) {
      if (strict) throw new PageInputError(`Bloco ${index + 1}: o bloco salvo escolhido não existe mais. Escolha outro ou remova o bloco.`);
      return null;
    }
    shared.set(index, { id: saved.id, name: saved.name });
    const { shared: _id, ...local } = block;
    return { ...saved.data, ...local };
  });
  return { sections: out, shared };
}

// Executa fn(client) numa transação; traduz "imagem não existe mais" para mensagem do painel.
async function inTransaction(fn) {
  const client = await pool.connect();
  let broken; // ROLLBACK falhou (conexão caiu): o cliente é descartado em vez de voltar ao pool
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => { broken = rollbackError; }); // mantém o erro original
    if (error.code === "23503" && error.constraint === "sales_page_media_media_fkey") {
      throw new PageInputError("Uma das imagens escolhidas não existe mais. Escolha outra.");
    }
    if (error.code === "23503" && error.constraint === "sales_page_shared_blocks_block_fkey") {
      throw new PageInputError("Um dos blocos salvos usados na página não existe mais. Escolha outro ou remova o bloco.");
    }
    throw error;
  } finally {
    client.release(broken);
  }
}

// Salva o RASCUNHO (cria a página se ainda não existir). Nunca altera a versão publicada.
// Devolve { page, created }.
async function savePage(productId, body) {
  const input = normalizeInput(body);
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO sales_pages (product_id, sections, theme)
       VALUES ($1, $2::jsonb, $3::jsonb)
       ON CONFLICT (product_id) DO UPDATE SET
         sections = EXCLUDED.sections, theme = EXCLUDED.theme, updated_at = CURRENT_TIMESTAMP
       RETURNING id, (xmax = 0) AS created`,
      [productId, JSON.stringify(input.sections), JSON.stringify(input.theme)]
    );
    await syncPageMedia(client, rows[0].id);
    const page = (await client.query(`SELECT ${PAGE_COLUMNS} FROM sales_pages WHERE id = $1`, [rows[0].id])).rows[0];
    return { page, created: rows[0].created };
  });
}

// PUBLICA: a versão publicada passa a ser uma cópia do rascunho salvo. null se não houver página.
async function publishPage(productId) {
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE sales_pages SET
         published_sections = sections, published_theme = theme, published_at = CURRENT_TIMESTAMP
       WHERE product_id = $1 RETURNING id`,
      [productId]
    );
    if (!rows.length) return null;
    await syncPageMedia(client, rows[0].id);
    return (await client.query(`SELECT ${PAGE_COLUMNS} FROM sales_pages WHERE id = $1`, [rows[0].id])).rows[0];
  });
}

async function getPage(productId) {
  const { rows } = await pool.query(`SELECT ${PAGE_COLUMNS} FROM sales_pages WHERE product_id = $1`, [productId]);
  return rows[0] || null;
}

// Map id -> imagem (com URL pública) das imagens usadas nos blocos, da capa e do logo da marca.
async function loadMedia(sections, ...productImageIds) {
  const ids = mediaIds(sections);
  productImageIds.forEach((id) => id && ids.push(id));
  const media = new Map();
  if (ids.length) {
    const result = await pool.query(
      "SELECT id, storage_key, width, height, alt_text FROM media WHERE id = ANY($1::uuid[])", [ids]);
    result.rows.forEach(({ storage_key: key, ...m }) => media.set(m.id, { ...m, url: storage.publicUrl(key) }));
  }
  return media;
}

// Rascunho para a pré-visualização ao vivo do editor: usa os blocos enviados (validados),
// sem gravar nada. Devolve null se o produto não existir; lança PageInputError se inválido.
async function loadDraftForRender(productId, body) {
  const input = normalizeInput(body);
  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products p WHERE p.id = $1`, [productId]);
  if (!rows.length) return null;
  const { sections, shared } = await resolveShared(input.sections, { strict: true });
  return {
    ...rows[0], sections, shared, theme: input.theme,
    published_at: null, media: await loadMedia(storedBlocks(sections), rows[0].image_id, rows[0].brand_logo_id),
  };
}

// Tudo o que o template precisa: produto, página e um Map id -> imagem (com URL pública).
//   version "published": versão PUBLICADA, e só se o produto estiver publicado (rota pública).
//   version "draft":     RASCUNHO salvo, em qualquer situação (pré-visualização do painel).
async function loadForRender({ slug, productId, version }) {
  const where = slug ? "p.slug = $1" : "p.id = $1";
  const published = version === "published";
  const columns = published
    ? "sp.published_sections AS sections, sp.published_theme AS theme"
    : "sp.sections, sp.theme";
  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS}, ${columns}, sp.published_at
       FROM products p JOIN sales_pages sp ON sp.product_id = p.id
      WHERE ${where} ${published ? "AND p.status = 'published' AND sp.published_sections IS NOT NULL" : ""}`,
    [slug || productId]
  );
  if (!rows.length) return null;
  const { sections, shared } = await resolveShared(rows[0].sections);
  const data = { ...rows[0], sections, shared };
  const media = await loadMedia(storedBlocks(sections), data.image_id, data.brand_logo_id);
  return { ...data, media };
}

module.exports = { PageInputError, savePage, publishPage, getPage, loadForRender, loadDraftForRender };
