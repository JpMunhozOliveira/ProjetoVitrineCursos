const pool = require("../config/database");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_FIELDS = new Set([
  "headline",
  "subheadline",
  "sections",
  "seo_title",
  "seo_description",
  "published",
]);

function validatePageInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const unknown = Object.keys(body).filter((key) => !PAGE_FIELDS.has(key));
  if (unknown.length) {
    return { error: `Unsupported field(s): ${unknown.join(", ")}` };
  }

  const values = {};

  for (const field of ["headline", "subheadline", "seo_title", "seo_description"]) {
    if (!(field in body)) continue;
    if (body[field] !== null && typeof body[field] !== "string") {
      return { error: `${field} must be a string or null.` };
    }
    values[field] = body[field]?.trim() || null;
  }

  if ("headline" in values && values.headline && values.headline.length > 220) {
    return { error: "headline must not exceed 220 characters." };
  }
  if ("seo_title" in values && values.seo_title && values.seo_title.length > 220) {
    return { error: "seo_title must not exceed 220 characters." };
  }
  if ("seo_description" in values && values.seo_description && values.seo_description.length > 320) {
    return { error: "seo_description must not exceed 320 characters." };
  }

  if ("sections" in body) {
    if (!Array.isArray(body.sections)) {
      return { error: "sections must be an array." };
    }
    if (body.sections.some((section) => !section || typeof section !== "object" || Array.isArray(section))) {
      return { error: "Every section must be a JSON object." };
    }
    values.sections = body.sections;
  }

  if ("published" in body && typeof body.published !== "boolean") {
    return { error: "published must be a boolean." };
  }
  if ("published" in body) values.published = body.published;

  if (Object.keys(values).length === 0) {
    return { error: "Provide at least one supported field." };
  }

  return { values };
}

async function getAdminSalesPage(req, res, next) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ error: "ID de produto inválido." });
  }

  try {
    const product = await pool.query("SELECT id FROM products WHERE id = $1", [req.params.id]);
    if (!product.rowCount) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    const result = await pool.query(
      `SELECT id, product_id, headline, subheadline, sections, seo_title,
              seo_description, published_at, created_at, updated_at
       FROM sales_pages WHERE product_id = $1`,
      [req.params.id]
    );

    return res.json({ data: result.rows[0] ?? null });
  } catch (error) {
    return next(error);
  }
}

async function saveAdminSalesPage(req, res, next) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ error: "ID de produto inválido." });
  }

  const { values, error } = validatePageInput(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const product = await pool.query("SELECT id FROM products WHERE id = $1", [req.params.id]);
    if (!product.rowCount) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    const current = await pool.query(
      "SELECT id FROM sales_pages WHERE product_id = $1",
      [req.params.id]
    );

    const headline = values.headline ?? null;
    const subheadline = values.subheadline ?? null;
    const sections = values.sections ?? [];
    const seoTitle = values.seo_title ?? null;
    const seoDescription = values.seo_description ?? null;
    const shouldPublish = values.published ?? false;

    const result = await pool.query(
      `INSERT INTO sales_pages
        (product_id, headline, subheadline, sections, seo_title, seo_description, published_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6,
               CASE WHEN $7 THEN CURRENT_TIMESTAMP ELSE NULL END)
       ON CONFLICT (product_id) DO UPDATE SET
         headline = CASE WHEN $8 THEN EXCLUDED.headline ELSE sales_pages.headline END,
         subheadline = CASE WHEN $9 THEN EXCLUDED.subheadline ELSE sales_pages.subheadline END,
         sections = CASE WHEN $10 THEN EXCLUDED.sections ELSE sales_pages.sections END,
         seo_title = CASE WHEN $11 THEN EXCLUDED.seo_title ELSE sales_pages.seo_title END,
         seo_description = CASE WHEN $12 THEN EXCLUDED.seo_description ELSE sales_pages.seo_description END,
         published_at = CASE
           WHEN $13 THEN COALESCE(sales_pages.published_at, CURRENT_TIMESTAMP)
           WHEN $14 THEN NULL
           ELSE sales_pages.published_at
         END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, product_id, headline, subheadline, sections, seo_title,
                 seo_description, published_at, created_at, updated_at`,
      [
        req.params.id,
        headline,
        subheadline,
        JSON.stringify(sections),
        seoTitle,
        seoDescription,
        shouldPublish,
        "headline" in values,
        "subheadline" in values,
        "sections" in values,
        "seo_title" in values,
        "seo_description" in values,
        shouldPublish,
        "published" in values && !shouldPublish,
      ]
    );

    return res.status(current.rowCount ? 200 : 201).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

async function getPublicSalesPage(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT c.id AS product_id, c.title AS product_title, c.slug,
              c.short_description, p.headline, p.subheadline, p.sections,
              p.seo_title, p.seo_description, p.published_at
       FROM products c
       JOIN sales_pages p ON p.product_id = c.id
       WHERE c.slug = $1 AND c.status = 'published'
         AND p.published_at IS NOT NULL`,
      [req.params.slug]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Página de vendas publicada não encontrada." });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getAdminSalesPage, saveAdminSalesPage, getPublicSalesPage };
