// Gravação e leitura das páginas de vendas (usado pela API do painel, pela rota pública
// /p/:slug, pela pré-visualização e pelo script de importação).
const pool = require("../config/database");
const storage = require("../lib/storage");
const { validateSections, mediaIds } = require("./blocks");
const { normalizeTheme, ThemeError } = require("./theme");

const PAGE_COLUMNS = `id, product_id, sections, seo_title, seo_description, theme, published_at, created_at, updated_at`;

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
  const allowed = ["sections", "seo_title", "seo_description", "theme", "published"];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new PageInputError(`Campo(s) não suportado(s): ${unknown.join(", ")}.`);

  const { sections, error } = validateSections(body.sections ?? []);
  if (error) throw new PageInputError(error);
  if (body.published !== undefined && typeof body.published !== "boolean") {
    throw new PageInputError("published deve ser verdadeiro ou falso.");
  }
  return {
    sections,
    seo_title: text(body.seo_title, 220, "Título para buscadores"),
    seo_description: text(body.seo_description, 320, "Descrição para buscadores"),
    theme: storedTheme(body.theme),
    published: body.published,
  };
}

// Cria ou substitui a página do produto. Transação: a página e o registro das imagens usadas
// são gravados juntos (ou nada é gravado). Devolve { page, created }.
async function savePage(productId, body) {
  const input = normalizeInput(body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO sales_pages (product_id, sections, seo_title, seo_description, theme, published_at)
       VALUES ($1, $2::jsonb, $3, $4, $6::jsonb, CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP END)
       ON CONFLICT (product_id) DO UPDATE SET
         sections = EXCLUDED.sections,
         seo_title = EXCLUDED.seo_title,
         seo_description = EXCLUDED.seo_description,
         theme = EXCLUDED.theme,
         -- published ausente: mantém como está; true: mantém a data original da 1ª publicação.
         published_at = CASE
           WHEN $5::boolean IS NULL THEN sales_pages.published_at
           WHEN $5::boolean THEN COALESCE(sales_pages.published_at, CURRENT_TIMESTAMP)
           ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING ${PAGE_COLUMNS}, (xmax = 0) AS created`,
      [productId, JSON.stringify(input.sections), input.seo_title, input.seo_description, input.published ?? null, JSON.stringify(input.theme)]
    );
    const page = rows[0];

    await client.query("DELETE FROM sales_page_media WHERE sales_page_id = $1", [page.id]);
    const ids = mediaIds(input.sections);
    if (ids.length) {
      await client.query(
        `INSERT INTO sales_page_media (sales_page_id, media_id) SELECT $1, unnest($2::uuid[])`,
        [page.id, ids]
      );
    }
    await client.query("COMMIT");
    const { created, ...rest } = page;
    return { page: rest, created };
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
  const { published, ...rest } = body || {}; // publicar não se aplica a um rascunho
  const input = normalizeInput(rest);
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
// published = true exige produto publicado E página publicada (rota pública).
async function loadForRender({ slug, productId, published }) {
  const where = slug ? "p.slug = $1" : "p.id = $1";
  const onlyPublished = published ? "AND p.status = 'published' AND sp.published_at IS NOT NULL" : "";
  const { rows } = await pool.query(
    `SELECT p.id, p.title, p.slug, p.short_description, p.price_cents, p.checkout_url, p.image_id, p.status,
            sp.sections, sp.seo_title, sp.seo_description, sp.theme, sp.published_at
       FROM products p JOIN sales_pages sp ON sp.product_id = p.id
      WHERE ${where} ${onlyPublished}`,
    [slug || productId]
  );
  if (!rows.length) return null;
  const data = rows[0];
  const media = await loadMedia(validateSections(data.sections).sections || [], data.image_id);
  return { ...data, media };
}

module.exports = { PageInputError, savePage, getPage, loadForRender, loadDraftForRender };
