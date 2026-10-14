const pool = require("../config/database");
const storage = require("../lib/storage");

// Colunas do produto (alias "p") + dados da imagem de capa (alias "m", via LEFT JOIN).
const COLUMNS = `p.id, p.title, p.slug, p.short_description, p.status, p.category, p.featured,
  p.description, p.audience, p.prerequisites, p.modules, p.format, p.workload, p.price_cents,
  p.checkout_url, p.image_id, p.created_at, p.updated_at,
  CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object(
    'id', m.id, 'storage_key', m.storage_key, 'alt_text', m.alt_text,
    'width', m.width, 'height', m.height) END AS image`;

// "source" é a tabela products ou um CTE com o resultado de um INSERT/UPDATE.
const selectFrom = (source) => `SELECT ${COLUMNS} FROM ${source} p LEFT JOIN media m ON m.id = p.image_id`;

// Troca a chave interna do arquivo pela URL pública.
function toResponse(row) {
  if (row.image) {
    const { storage_key: key, ...image } = row.image;
    row.image = { ...image, url: storage.publicUrl(key) };
  }
  return row;
}

const STATUSES = ["draft", "published", "archived"];
const MAX_PRICE_CENTS = 100_000_000; // R$ 1.000.000,00

// Textos opcionais: campo -> tamanho máximo. Vazio vira null (o site oculta campos nulos).
const OPTIONAL_TEXT = {
  short_description: 500,
  category: 80,
  description: 10000,
  audience: 2000,
  prerequisites: 2000,
  format: 120,
  workload: 60,
};

const FIELDS = new Set([
  "title", "slug", "status", "featured", "modules", "price_cents", "checkout_url", "image_id",
  ...Object.keys(OPTIONAL_TEXT),
]);

function normalizeProductInput(body, isCreate = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "O corpo da requisição deve ser um objeto JSON." };
  }

  const keys = Object.keys(body);
  const unknown = keys.filter((key) => !FIELDS.has(key));
  if (unknown.length) return { error: `Campo(s) não suportado(s): ${unknown.join(", ")}` };
  if (!isCreate && !keys.length) return { error: "Informe ao menos um campo para atualizar." };
  if (isCreate && (!("title" in body) || !("slug" in body))) {
    return { error: "Título e endereço (slug) são obrigatórios." };
  }

  const values = {};

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 180) return { error: "O título deve ter entre 1 e 180 caracteres." };
    values.title = title;
  }

  if ("slug" in body) {
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) {
      return { error: "O endereço (slug) deve usar letras minúsculas, números e hifens simples." };
    }
    values.slug = slug;
  }

  if ("status" in body) {
    if (!STATUSES.includes(body.status)) return { error: "Situação inválida." };
    values.status = body.status;
  }

  for (const [field, max] of Object.entries(OPTIONAL_TEXT)) {
    if (!(field in body)) continue;
    if (body[field] !== null && typeof body[field] !== "string") {
      return { error: `${field} deve ser texto ou null.` };
    }
    const text = body[field]?.trim() || null;
    if (text && text.length > max) return { error: `${field} deve ter no máximo ${max} caracteres.` };
    values[field] = text;
  }

  if ("featured" in body) {
    if (typeof body.featured !== "boolean") return { error: "featured deve ser true ou false." };
    values.featured = body.featured;
  }

  if ("modules" in body) {
    if (!Array.isArray(body.modules) || body.modules.some((m) => typeof m !== "string")) {
      return { error: "modules deve ser uma lista de textos." };
    }
    const modules = body.modules.map((m) => m.trim()).filter(Boolean);
    if (modules.length > 100 || modules.some((m) => m.length > 200)) {
      return { error: "Use no máximo 100 módulos, com até 200 caracteres cada." };
    }
    // O driver pg envia arrays JS como array do Postgres; para JSONB, mandamos o texto JSON.
    values.modules = JSON.stringify(modules);
  }

  if ("price_cents" in body) {
    const price = body.price_cents;
    if (price !== null && !(Number.isInteger(price) && price >= 0 && price <= MAX_PRICE_CENTS)) {
      return { error: "O preço deve ser um valor inteiro em centavos, entre 0 e 100000000, ou null." };
    }
    values.price_cents = price;
  }

  if ("checkout_url" in body) {
    if (body.checkout_url !== null && typeof body.checkout_url !== "string") {
      return { error: "checkout_url deve ser texto ou null." };
    }
    const raw = body.checkout_url?.trim() || null;
    if (raw) {
      const url = parseHttpsUrl(raw);
      if (!url || url.length > 2048) return { error: "O link de checkout deve ser um endereço https:// válido." };
      values.checkout_url = url;
    } else {
      values.checkout_url = null;
    }
  }

  // A existência da imagem é conferida pelo banco (chave estrangeira); aqui só o formato.
  if ("image_id" in body) {
    if (body.image_id !== null && !isValidId(body.image_id)) return { error: "image_id inválido." };
    values.image_id = body.image_id;
  }

  return { values };
}

// Devolve a URL normalizada (ex.: "HTTPS://" vira "https://") ou null se não for https.
function parseHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

function isValidId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const isDuplicateSlug = (error) => error.code === "23505" && error.constraint === "products_slug_key";
const isMissingImage = (error) => error.code === "23503" && error.constraint === "products_image_id_fkey";
const DUPLICATE_SLUG = { error: "Já existe um produto com este endereço (slug)." };
const MISSING_IMAGE = { error: "A imagem escolhida não existe mais. Escolha outra." };
const INVALID_ID = { error: "ID de produto inválido." };
const NOT_FOUND = { error: "Produto não encontrado." };

async function listPublicProducts(_req, res) {
  const result = await pool.query(
    `${selectFrom("products")} WHERE p.status = 'published' ORDER BY p.created_at DESC`
  );
  return res.json({ data: result.rows.map(toResponse) });
}

async function getPublicProduct(req, res) {
  const result = await pool.query(
    `${selectFrom("products")} WHERE p.slug = $1 AND p.status = 'published'`,
    [req.params.slug]
  );
  if (!result.rowCount) return res.status(404).json(NOT_FOUND);
  return res.json({ data: toResponse(result.rows[0]) });
}

async function listAdminProducts(_req, res) {
  const result = await pool.query(`${selectFrom("products")} ORDER BY p.created_at DESC`);
  return res.json({ data: result.rows.map(toResponse) });
}

async function getAdminProduct(req, res) {
  if (!isValidId(req.params.id)) return res.status(400).json(INVALID_ID);

  const result = await pool.query(`${selectFrom("products")} WHERE p.id = $1`, [req.params.id]);
  if (!result.rowCount) return res.status(404).json(NOT_FOUND);
  return res.json({ data: toResponse(result.rows[0]) });
}

async function createProduct(req, res) {
  const { values, error } = normalizeProductInput(req.body, true);
  if (error) return res.status(400).json({ error });

  // Os nomes de coluna vêm da lista FIELDS (nunca do usuário); os valores vão como parâmetros.
  const fields = Object.keys(values);
  const placeholders = fields.map((_, index) => `$${index + 1}`);

  try {
    // CTE (WITH): grava e, na mesma consulta, devolve o produto já com os dados da imagem.
    const result = await pool.query(
      `WITH saved AS (
         INSERT INTO products (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *)
       ${selectFrom("saved")}`,
      fields.map((field) => values[field])
    );
    return res.status(201).json({ data: toResponse(result.rows[0]) });
  } catch (error) {
    if (isDuplicateSlug(error)) return res.status(409).json(DUPLICATE_SLUG);
    if (isMissingImage(error)) return res.status(400).json(MISSING_IMAGE);
    throw error;
  }
}

async function updateProduct(req, res) {
  if (!isValidId(req.params.id)) return res.status(400).json(INVALID_ID);

  const { values, error } = normalizeProductInput(req.body);
  if (error) return res.status(400).json({ error });

  const fields = Object.keys(values);
  const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
  assignments.push("updated_at = CURRENT_TIMESTAMP");

  try {
    const result = await pool.query(
      `WITH saved AS (
         UPDATE products SET ${assignments.join(", ")} WHERE id = $1 RETURNING *)
       ${selectFrom("saved")}`,
      [req.params.id, ...fields.map((field) => values[field])]
    );
    if (!result.rowCount) return res.status(404).json(NOT_FOUND);
    return res.json({ data: toResponse(result.rows[0]) });
  } catch (error) {
    if (isDuplicateSlug(error)) return res.status(409).json(DUPLICATE_SLUG);
    if (isMissingImage(error)) return res.status(400).json(MISSING_IMAGE);
    throw error;
  }
}

// Exclusão definitiva só para rascunhos e arquivados; publicados devem ser arquivados antes
// (evita apagar sem querer um produto com links já divulgados). Para arquivar ou restaurar,
// use PATCH com { "status": "archived" } ou { "status": "draft" }.
async function deleteProduct(req, res) {
  if (!isValidId(req.params.id)) return res.status(400).json(INVALID_ID);

  const deleted = await pool.query(
    "DELETE FROM products WHERE id = $1 AND status IN ('draft', 'archived')",
    [req.params.id]
  );
  if (deleted.rowCount) return res.status(204).end();

  const exists = await pool.query("SELECT 1 FROM products WHERE id = $1", [req.params.id]);
  if (!exists.rowCount) return res.status(404).json(NOT_FOUND);
  return res.status(409).json({ error: "Produtos publicados não podem ser excluídos. Arquive-o primeiro." });
}

module.exports = {
  listPublicProducts,
  getPublicProduct,
  listAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
