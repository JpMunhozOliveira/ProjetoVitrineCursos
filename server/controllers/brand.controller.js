// Empresas (aba "Empresas" do painel): nome e logo de quem vende, escolhidos em cada produto.
// Alterar uma empresa muda na hora o menu e o rodapé das páginas de vendas e os cards do catálogo
// de todos os produtos dela (eles leem a empresa ao desenhar a página; nada fica copiado).
const pool = require("../config/database");
const storage = require("../lib/storage");
const { UUID, normalizeBrandBody } = require("../lib/brand-input");

const NOT_FOUND = { error: "Empresa não encontrada." };
const MISSING_LOGO = { error: "A imagem escolhida para o logo ou o ícone não existe mais. Escolha outra." };

// "usage": produtos que usam a empresa. "kiwify": conta Kiwify conectada (sem o segredo; do
// Client ID, só os 4 últimos caracteres, para conferir qual chave está em uso).
const SELECT_BRAND = `
  SELECT b.id, b.name, b.created_at, b.updated_at,
         (SELECT json_build_object('account_id', k.account_id, 'client_id_hint', right(k.client_id, 4),
             'updated_at', k.updated_at) FROM kiwify_accounts k WHERE k.brand_id = b.id) AS kiwify,
         CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object(
           'id', m.id, 'storage_key', m.storage_key, 'alt_text', m.alt_text,
           'width', m.width, 'height', m.height, 'original_name', m.original_name) END AS logo,
         CASE WHEN ic.id IS NULL THEN NULL ELSE json_build_object(
           'id', ic.id, 'storage_key', ic.storage_key, 'alt_text', ic.alt_text,
           'width', ic.width, 'height', ic.height, 'original_name', ic.original_name) END AS icon,
         COALESCE((SELECT json_agg(json_build_object('id', p.id, 'title', p.title) ORDER BY p.title)
             FROM products p WHERE p.brand_id = b.id), '[]') AS usage
    FROM brands b LEFT JOIN media m ON m.id = b.logo_id LEFT JOIN media ic ON ic.id = b.icon_id`;

// Troca a chave interna do arquivo pela URL pública (logo e ícone da aba).
function toResponse(row) {
  for (const field of ["logo", "icon"]) {
    if (!row[field]) continue;
    const { storage_key: key, ...image } = row[field];
    row[field] = { ...image, url: storage.publicUrl(key) };
  }
  return row;
}

const isMissingLogo = (error) => error.code === "23503"
  && ["brands_logo_id_fkey", "brands_icon_id_fkey"].includes(error.constraint);

async function findBrand(id) {
  const { rows } = await pool.query(`${SELECT_BRAND} WHERE b.id = $1`, [id]);
  return rows[0] ? toResponse(rows[0]) : null;
}

async function listBrands(_req, res) {
  const { rows } = await pool.query(`${SELECT_BRAND} ORDER BY lower(b.name) NULLS LAST, b.created_at`);
  return res.json({ data: rows.map(toResponse) });
}

async function createBrand(req, res) {
  const { value, error } = normalizeBrandBody(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await pool.query(
      "INSERT INTO brands (name, logo_id, icon_id) VALUES ($1, $2, $3) RETURNING id",
      [value.name, value.logoId, value.iconId]);
    return res.status(201).json({ data: await findBrand(rows[0].id) });
  } catch (err) {
    if (isMissingLogo(err)) return res.status(400).json(MISSING_LOGO);
    throw err;
  }
}

async function updateBrand(req, res) {
  if (!UUID.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  const { value, error } = normalizeBrandBody(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rowCount } = await pool.query(
      "UPDATE brands SET name = $2, logo_id = $3, icon_id = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [req.params.id, value.name, value.logoId, value.iconId]);
    if (!rowCount) return res.status(404).json(NOT_FOUND);
    return res.json({ data: await findBrand(req.params.id) });
  } catch (err) {
    if (isMissingLogo(err)) return res.status(400).json(MISSING_LOGO);
    throw err;
  }
}

// Exclusão bloqueada se algum produto usa a empresa (o banco também recusa, via ON DELETE RESTRICT:
// é o que barra a corrida em que um produto passa a usá-la entre a conferência e a exclusão).
async function deleteBrand(req, res) {
  if (!UUID.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  let deleted = 0;
  try {
    ({ rowCount: deleted } = await pool.query(
      `DELETE FROM brands b WHERE b.id = $1
          AND NOT EXISTS (SELECT 1 FROM products p WHERE p.brand_id = b.id)`,
      [req.params.id]));
  } catch (err) {
    if (err.code !== "23503") throw err; // passou a ser usada no meio do caminho -> 409 abaixo
  }
  if (deleted) return res.status(204).end();

  const found = await findBrand(req.params.id);
  if (!found) return res.status(404).json(NOT_FOUND);
  const where = found.usage.map((u) => `“${u.title}”`).join(", ");
  return res.status(409).json({
    error: `Esta empresa está em uso nos produtos ${where}. Escolha outra empresa nesses produtos antes de excluí-la.`,
  });
}

module.exports = { listBrands, createBrand, updateBrand, deleteBrand };
