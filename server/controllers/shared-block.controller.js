// Blocos salvos (aba "Blocos salvos" do painel): conteúdo cadastrado uma vez e usado em várias
// páginas de vendas. Alterar um bloco salvo muda na hora todas as páginas que o usam, inclusive as
// publicadas (a página guarda só a referência; ver resolveShared em sales/pages.js).
const pool = require("../config/database");
const { SHAREABLE, validateSharedData } = require("../sales/blocks");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOT_FOUND = { error: "Bloco salvo não encontrado." };

// "usage": páginas de vendas que usam o bloco (no rascunho ou na versão publicada).
const SELECT_BLOCK = `
  SELECT sb.id, sb.type, sb.name, sb.data, sb.created_at, sb.updated_at,
         COALESCE((SELECT json_agg(json_build_object('id', p.id, 'title', p.title, 'slug', p.slug) ORDER BY p.title)
             FROM sales_page_shared_blocks x
             JOIN sales_pages sp ON sp.id = x.sales_page_id
             JOIN products p ON p.id = sp.product_id
            WHERE x.shared_block_id = sb.id), '[]') AS usage
    FROM shared_blocks sb`;

// Corpo de criação (com type) ou de alteração (sem type). Devolve { value } ou { error }.
function normalizeBody(body, { creating }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Envie um objeto JSON." };
  const allowed = creating ? ["type", "name", "data"] : ["name", "data"];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) return { error: `Campo(s) não suportado(s): ${unknown.join(", ")}.` };
  if (creating && !Object.hasOwn(SHAREABLE, body.type)) return { error: "Tipo de bloco inválido." };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Dê um nome ao bloco salvo (ex.: Redes — Prof. Fulano)." };
  if (name.length > 120) return { error: "O nome deve ter no máximo 120 caracteres." };
  return { value: { name, type: body.type, data: body.data } };
}

async function listSharedBlocks(_req, res) {
  const { rows } = await pool.query(`${SELECT_BLOCK} ORDER BY lower(sb.name)`);
  return res.json({ data: rows });
}

async function createSharedBlock(req, res) {
  const { value, error } = normalizeBody(req.body, { creating: true });
  if (error) return res.status(400).json({ error });
  const checked = validateSharedData(value.type, value.data);
  if (checked.error) return res.status(400).json({ error: checked.error });

  const { rows } = await pool.query(
    "INSERT INTO shared_blocks (type, name, data) VALUES ($1, $2, $3::jsonb) RETURNING id",
    [value.type, value.name, JSON.stringify(checked.data)]);
  const created = await pool.query(`${SELECT_BLOCK} WHERE sb.id = $1`, [rows[0].id]);
  return res.status(201).json({ data: created.rows[0] });
}

async function updateSharedBlock(req, res) {
  if (!UUID.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  const { value, error } = normalizeBody(req.body, { creating: false });
  if (error) return res.status(400).json({ error });

  const found = await pool.query("SELECT type FROM shared_blocks WHERE id = $1", [req.params.id]);
  if (!found.rowCount) return res.status(404).json(NOT_FOUND);
  const checked = validateSharedData(found.rows[0].type, value.data);
  if (checked.error) return res.status(400).json({ error: checked.error });

  await pool.query(
    "UPDATE shared_blocks SET name = $2, data = $3::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [req.params.id, value.name, JSON.stringify(checked.data)]);
  const updated = await pool.query(`${SELECT_BLOCK} WHERE sb.id = $1`, [req.params.id]);
  return res.json({ data: updated.rows[0] });
}

// Exclusão bloqueada se alguma página usa o bloco (o banco também recusa, via ON DELETE RESTRICT:
// é o que barra a corrida em que uma página passa a usá-lo entre a conferência e a exclusão).
async function deleteSharedBlock(req, res) {
  if (!UUID.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  let deleted = 0;
  try {
    ({ rowCount: deleted } = await pool.query(
      `DELETE FROM shared_blocks sb WHERE sb.id = $1
          AND NOT EXISTS (SELECT 1 FROM sales_page_shared_blocks x WHERE x.shared_block_id = sb.id)`,
      [req.params.id]));
  } catch (error) {
    if (error.code !== "23503") throw error; // passou a ser usado no meio do caminho -> 409 abaixo
  }
  if (deleted) return res.status(204).end();

  const found = await pool.query(`${SELECT_BLOCK} WHERE sb.id = $1`, [req.params.id]);
  if (!found.rowCount) return res.status(404).json(NOT_FOUND);
  const where = found.rows[0].usage.map((u) => `“${u.title}”`).join(", ");
  return res.status(409).json({
    error: `Este bloco está em uso nas páginas de vendas de ${where}. Remova-o ou desvincule-o nessas páginas antes de excluir.`,
  });
}

module.exports = { listSharedBlocks, createSharedBlock, updateSharedBlock, deleteSharedBlock };
