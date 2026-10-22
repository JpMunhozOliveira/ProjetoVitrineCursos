const pool = require("../config/database");
const storage = require("../lib/storage");
const { normalizeCategory } = require("../lib/categories");
const kiwify = require("../lib/kiwify");
const { fetchCheckout, syncProduct, errorText } = require("../lib/kiwify-sync");

// Colunas do produto (alias "p") + dados da capa (alias "m") e da empresa (alias "b", aba Empresas)
// com o logo dela (alias "bl"). brand_name / brand_logo_id / brand_logo mantêm os nomes de quando
// ficavam no próprio produto: o site e a página de vendas leem esses campos.
const COLUMNS = `p.id, p.title, p.slug, p.short_description, p.status, p.category, p.area, p.featured,
  p.format, p.workload, p.price_cents, p.checkout_url, p.image_id, p.brand_id,
  b.name AS brand_name, b.logo_id AS brand_logo_id,
  p.created_at, p.updated_at,
  CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object(
    'id', m.id, 'storage_key', m.storage_key, 'alt_text', m.alt_text,
    'width', m.width, 'height', m.height, 'variants', m.variants) END AS image,
  CASE WHEN bl.id IS NULL THEN NULL ELSE json_build_object(
    'id', bl.id, 'storage_key', bl.storage_key, 'alt_text', bl.alt_text,
    'width', bl.width, 'height', bl.height) END AS brand_logo`;

// "source" é a tabela products ou um CTE com o resultado de um INSERT/UPDATE.
const selectFrom = (source, extra = "") => `SELECT ${COLUMNS}${extra} FROM ${source} p
  LEFT JOIN media m ON m.id = p.image_id
  LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN media bl ON bl.id = b.logo_id`;

// Só no painel: vínculo com a Kiwify e situação da última atualização automática.
const ADMIN_EXTRA = `,
  p.kiwify_product_id, p.kiwify_link_id, p.kiwify_synced_at, p.kiwify_sync_error`;

// Site público: o produto tem página de vendas PUBLICADA? (o catálogo leva direto para /p/endereco)
const HAS_SALES_PAGE = `,
  EXISTS (SELECT 1 FROM sales_pages sp WHERE sp.product_id = p.id AND sp.published_sections IS NOT NULL) AS has_sales_page`;

// Troca a chave interna do arquivo pela URL pública (capa e logo da marca). A capa também leva o
// srcset (versões menores, ver lib/images.js) para os cards do catálogo.
function toResponse(row) {
  for (const field of ["image", "brand_logo"]) {
    if (!row[field]) continue;
    const { storage_key: key, variants, ...image } = row[field];
    row[field] = { ...image, url: storage.publicUrl(key) };
    if (field === "image") row[field].srcset = storage.srcset(key, image.width, variants);
  }
  return row;
}

const STATUSES = ["draft", "published", "archived"];
const MAX_PRICE_CENTS = 100_000_000; // R$ 1.000.000,00

// Textos opcionais: campo -> tamanho máximo. Vazio vira null (o site oculta campos nulos).
const OPTIONAL_TEXT = {
  short_description: 500, // cards do catálogo e descrição no Google / prévia do link
  format: 120,
  workload: 60,
  area: 60, // área de conhecimento (página inicial e filtro do catálogo)
};

// Referências: capa (biblioteca de imagens) e empresa (null = marca do site). A existência é
// conferida pelo banco (chave estrangeira).
const IMAGE_FIELDS = ["image_id", "brand_id"];

// Vínculo com a Kiwify: produto e link de checkout, sempre os dois juntos (ou os dois null).
const KIWIFY_FIELDS = ["kiwify_product_id", "kiwify_link_id"];

const FIELDS = new Set([
  "title", "slug", "status", "category", "featured", "price_cents", "checkout_url",
  ...IMAGE_FIELDS, ...Object.keys(OPTIONAL_TEXT), ...KIWIFY_FIELDS,
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

  // Categoria: uma da lista fixa (lib/categories.js) ou null.
  if ("category" in body) {
    const { value, error } = normalizeCategory(body.category);
    if (error) return { error };
    values.category = value;
  }

  if ("featured" in body) {
    if (typeof body.featured !== "boolean") return { error: "featured deve ser true ou false." };
    values.featured = body.featured;
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
  for (const field of IMAGE_FIELDS) {
    if (!(field in body)) continue;
    if (body[field] !== null && !isValidId(body[field])) return { error: `${field} inválido.` };
    values[field] = body[field];
  }

  if (KIWIFY_FIELDS.some((field) => field in body)) {
    const [productId, linkId] = KIWIFY_FIELDS.map((field) => body[field] ?? null);
    const linked = productId !== null || linkId !== null;
    if (linked && !(kiwify.isId(productId) && kiwify.isId(linkId))) {
      return { error: "Escolha o produto e o link de checkout da Kiwify (ou desfaça o vínculo)." };
    }
    values.kiwify_product_id = productId;
    values.kiwify_link_id = linkId;
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
const isMissingBrand = (error) => error.code === "23503" && error.constraint === "products_brand_id_fkey";
const DUPLICATE_SLUG = { error: "Já existe um produto com este endereço (slug)." };
const MISSING_IMAGE = { error: "A imagem escolhida não existe mais. Escolha outra." };
const MISSING_BRAND = { error: "A empresa escolhida não existe mais. Escolha outra." };
const INVALID_ID = { error: "ID de produto inválido." };
const NOT_FOUND = { error: "Produto não encontrado." };

// Vínculo com a Kiwify ao salvar: preço e link vêm da Kiwify (sobrepõem os digitados).
//  - vínculo novo ou trocado: a Kiwify precisa responder, senão o produto não é salvo;
//  - vínculo igual ao gravado: se a Kiwify falhar, salva o resto e mantém o último preço/link;
//  - trocar a empresa sem informar o vínculo desfaz o vínculo (a conta Kiwify é da empresa).
// Devolve { error, status } para recusar o pedido.
async function applyKiwify(values, productId) {
  const current = productId
    ? (await pool.query("SELECT brand_id, kiwify_product_id, kiwify_link_id FROM products WHERE id = $1", [productId])).rows[0]
    : null;
  if (productId && !current) return {}; // não existe: o UPDATE responde 404

  if (!("kiwify_product_id" in values)) {
    if ("brand_id" in values && current?.kiwify_product_id && values.brand_id !== current.brand_id) {
      Object.assign(values, { kiwify_product_id: null, kiwify_link_id: null, kiwify_synced_at: null, kiwify_sync_error: null });
    }
    return {};
  }
  if (values.kiwify_product_id === null) {
    Object.assign(values, { kiwify_synced_at: null, kiwify_sync_error: null });
    return {};
  }

  const brandId = "brand_id" in values ? values.brand_id : current?.brand_id ?? null;
  const unchanged = current && current.brand_id === brandId
    && current.kiwify_product_id === values.kiwify_product_id && current.kiwify_link_id === values.kiwify_link_id;
  try {
    const checkout = await fetchCheckout(brandId, values.kiwify_product_id, values.kiwify_link_id);
    Object.assign(values, checkout, { kiwify_synced_at: new Date(), kiwify_sync_error: null });
  } catch (error) {
    if (!(error instanceof kiwify.KiwifyError)) throw error;
    if (!unchanged) return { status: error.status, error: error.message };
    delete values.price_cents; // mantém o último preço e link da Kiwify
    delete values.checkout_url;
    values.kiwify_sync_error = errorText(error);
  }
  return {};
}

async function listPublicProducts(_req, res) {
  const result = await pool.query(
    `${selectFrom("products", HAS_SALES_PAGE)} WHERE p.status = 'published' ORDER BY p.created_at DESC`
  );
  return res.json({ data: result.rows.map(toResponse) });
}

async function getPublicProduct(req, res) {
  const result = await pool.query(
    `${selectFrom("products", HAS_SALES_PAGE)} WHERE p.slug = $1 AND p.status = 'published'`,
    [req.params.slug]
  );
  if (!result.rowCount) return res.status(404).json(NOT_FOUND);
  return res.json({ data: toResponse(result.rows[0]) });
}

async function listAdminProducts(_req, res) {
  const result = await pool.query(`${selectFrom("products", ADMIN_EXTRA)} ORDER BY p.created_at DESC`);
  return res.json({ data: result.rows.map(toResponse) });
}

async function getAdminProduct(req, res) {
  if (!isValidId(req.params.id)) return res.status(400).json(INVALID_ID);

  const result = await pool.query(`${selectFrom("products", ADMIN_EXTRA)} WHERE p.id = $1`, [req.params.id]);
  if (!result.rowCount) return res.status(404).json(NOT_FOUND);
  return res.json({ data: toResponse(result.rows[0]) });
}

async function createProduct(req, res) {
  const { values, error } = normalizeProductInput(req.body, true);
  if (error) return res.status(400).json({ error });
  const linked = await applyKiwify(values, null);
  if (linked.error) return res.status(linked.status).json({ error: linked.error });

  // Os nomes de coluna vêm da lista FIELDS (nunca do usuário); os valores vão como parâmetros.
  const fields = Object.keys(values);
  const placeholders = fields.map((_, index) => `$${index + 1}`);

  try {
    // CTE (WITH): grava e, na mesma consulta, devolve o produto já com os dados da imagem.
    const result = await pool.query(
      `WITH saved AS (
         INSERT INTO products (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *)
       ${selectFrom("saved", ADMIN_EXTRA)}`,
      fields.map((field) => values[field])
    );
    return res.status(201).json({ data: toResponse(result.rows[0]) });
  } catch (error) {
    if (isDuplicateSlug(error)) return res.status(409).json(DUPLICATE_SLUG);
    if (isMissingImage(error)) return res.status(400).json(MISSING_IMAGE);
    if (isMissingBrand(error)) return res.status(400).json(MISSING_BRAND);
    throw error;
  }
}

async function updateProduct(req, res) {
  if (!isValidId(req.params.id)) return res.status(400).json(INVALID_ID);

  const { values, error } = normalizeProductInput(req.body);
  if (error) return res.status(400).json({ error });
  const linked = await applyKiwify(values, req.params.id);
  if (linked.error) return res.status(linked.status).json({ error: linked.error });

  const fields = Object.keys(values);
  const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
  assignments.push("updated_at = CURRENT_TIMESTAMP");

  try {
    const result = await pool.query(
      `WITH saved AS (
         UPDATE products SET ${assignments.join(", ")} WHERE id = $1 RETURNING *)
       ${selectFrom("saved", ADMIN_EXTRA)}`,
      [req.params.id, ...fields.map((field) => values[field])]
    );
    if (!result.rowCount) return res.status(404).json(NOT_FOUND);
    return res.json({ data: toResponse(result.rows[0]) });
  } catch (error) {
    if (isDuplicateSlug(error)) return res.status(409).json(DUPLICATE_SLUG);
    if (isMissingImage(error)) return res.status(400).json(MISSING_IMAGE);
    if (isMissingBrand(error)) return res.status(400).json(MISSING_BRAND);
    throw error;
  }
}

// Botão "Atualizar agora": busca de novo preço e link na Kiwify.
async function syncKiwifyProduct(req, res) {
  if (!isValidId(req.params.id)) return res.status(400).json(INVALID_ID);
  try {
    const { found } = await syncProduct(req.params.id);
    if (!found) return res.status(404).json(NOT_FOUND);
  } catch (error) {
    if (!(error instanceof kiwify.KiwifyError)) throw error;
    return res.status(error.status).json({ error: error.message });
  }
  const result = await pool.query(`${selectFrom("products", ADMIN_EXTRA)} WHERE p.id = $1`, [req.params.id]);
  return res.json({ data: toResponse(result.rows[0]) });
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
  syncKiwifyProduct,
};
