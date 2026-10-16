// Gravação e leitura das páginas de vendas (usado pela API do painel, pela rota pública
// /p/:slug, pela pré-visualização e pelo script de importação).
//
// Duas versões por página:
//   RASCUNHO  (sections, seo_title, seo_description, theme)  -> o que o editor salva
//   PUBLICADA (published_*)                                   -> o que o público vê
// "Publicar" copia o rascunho para a versão publicada. Salvar nunca muda o site.
const pool = require("../config/database");
const storage = require("../lib/storage");
const { validateSections, mediaIds } = require("./blocks");
const { normalizeTheme, ThemeError } = require("./theme");

// has_unpublished_changes: o rascunho difere do que está publicado (ou nunca foi publicado).
const PAGE_COLUMNS = `id, product_id, sections, seo_title, seo_description, theme, published_at, created_at, updated_at,
  (published_sections IS DISTINCT FROM sections OR published_seo_title IS DISTINCT FROM seo_title
    OR published_seo_description IS DISTINCT FROM seo_description OR published_theme IS DISTINCT FROM theme
  ) AS has_unpublished_changes`;

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

function text(value, max, label) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new PageInputError(`${label} deve ser texto.`);
  const v = value.trim();
  if (v.length > max) throw new PageInputError(`${label}: máximo de ${max} caracteres.`);
  return v || null;
}

function normalizeInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PageInputError("Envie um objeto JSON.");
  const allowed = ["sections", "seo_title", "seo_description", "theme"];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new PageInputError(`Campo(s) não suportado(s): ${unknown.join(", ")}.`);

  const { sections, error } = validateSections(body.sections ?? []);
  if (error) throw new PageInputError(error);
  return {
    sections,
    seo_title: text(body.seo_title, 220, "Título para buscadores"),
    seo_description: text(body.seo_description, 320, "Descrição para buscadores"),
    theme: storedTheme(body.theme),
  };
}

// Imagens usadas na página = as do rascunho + as da versão publicada (ambas precisam existir:
// uma é editada, a outra está no ar). O banco recusa excluir qualquer uma delas.
async function syncPageMedia(client, pageId) {
  const { rows } = await client.query("SELECT sections, published_sections FROM sales_pages WHERE id = $1", [pageId]);
  const ids = new Set(mediaIds(rows[0].sections));
  mediaIds(validateSections(rows[0].published_sections || []).sections || []).forEach((id) => ids.add(id));
  await client.query("DELETE FROM sales_page_media WHERE sales_page_id = $1", [pageId]);
  if (ids.size) {
    await client.query("INSERT INTO sales_page_media (sales_page_id, media_id) SELECT $1, unnest($2::uuid[])", [pageId, [...ids]]);
  }
}

// Executa fn(client) numa transação; traduz "imagem não existe mais" para mensagem do painel.
async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23503" && error.constraint === "sales_page_media_media_fkey") {
      throw new PageInputError("Uma das imagens escolhidas não existe mais. Escolha outra.");
    }
    throw error;
  } finally {
    client.release();
  }
}

// Salva o RASCUNHO (cria a página se ainda não existir). Nunca altera a versão publicada.
// Devolve { page, created }.
async function savePage(productId, body) {
  const input = normalizeInput(body);
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO sales_pages (product_id, sections, seo_title, seo_description, theme)
       VALUES ($1, $2::jsonb, $3, $4, $5::jsonb)
       ON CONFLICT (product_id) DO UPDATE SET
         sections = EXCLUDED.sections, seo_title = EXCLUDED.seo_title,
         seo_description = EXCLUDED.seo_description, theme = EXCLUDED.theme,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, (xmax = 0) AS created`,
      [productId, JSON.stringify(input.sections), input.seo_title, input.seo_description, JSON.stringify(input.theme)]
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
         published_sections = sections, published_seo_title = seo_title,
         published_seo_description = seo_description, published_theme = theme,
         published_at = CURRENT_TIMESTAMP
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

// Map id -> imagem (com URL pública) das imagens usadas nos blocos e da capa do produto.
async function loadMedia(sections, coverId) {
  const ids = mediaIds(sections);
  if (coverId) ids.push(coverId);
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
    `SELECT id, title, slug, short_description, price_cents, checkout_url, image_id, status
       FROM products WHERE id = $1`, [productId]);
  if (!rows.length) return null;
  return {
    ...rows[0], sections: input.sections, seo_title: input.seo_title, seo_description: input.seo_description, theme: input.theme,
    published_at: null, media: await loadMedia(input.sections, rows[0].image_id),
  };
}

// Tudo o que o template precisa: produto, página e um Map id -> imagem (com URL pública).
//   version "published": versão PUBLICADA, e só se o produto estiver publicado (rota pública).
//   version "draft":     RASCUNHO salvo, em qualquer situação (pré-visualização do painel).
async function loadForRender({ slug, productId, version }) {
  const where = slug ? "p.slug = $1" : "p.id = $1";
  const published = version === "published";
  const columns = published
    ? "sp.published_sections AS sections, sp.published_seo_title AS seo_title, sp.published_seo_description AS seo_description, sp.published_theme AS theme"
    : "sp.sections, sp.seo_title, sp.seo_description, sp.theme";
  const { rows } = await pool.query(
    `SELECT p.id, p.title, p.slug, p.short_description, p.price_cents, p.checkout_url, p.image_id, p.status,
            ${columns}, sp.published_at
       FROM products p JOIN sales_pages sp ON sp.product_id = p.id
      WHERE ${where} ${published ? "AND p.status = 'published' AND sp.published_sections IS NOT NULL" : ""}`,
    [slug || productId]
  );
  if (!rows.length) return null;
  const data = rows[0];
  const media = await loadMedia(validateSections(data.sections).sections || [], data.image_id);
  return { ...data, media };
}

module.exports = { PageInputError, savePage, publishPage, getPage, loadForRender, loadDraftForRender };
