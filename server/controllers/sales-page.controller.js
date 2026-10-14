const pool = require("../config/database");
const { BLOCKS, ICONS, MAX_BLOCKS, defaultSections } = require("../sales/blocks");
const { PageInputError, savePage, getPage, loadDraftForRender } = require("../sales/pages");
const { renderSalesPage } = require("../sales/render");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVALID_ID = { error: "ID de produto inválido." };
const NOT_FOUND = { error: "Produto não encontrado." };

async function productExists(id) {
  const { rowCount } = await pool.query("SELECT 1 FROM products WHERE id = $1", [id]);
  return rowCount > 0;
}

// Esquema dos blocos para o editor do painel montar os formulários (fonte única: sales/blocks.js).
function getBlockSchema(_req, res) {
  return res.json({ data: { blocks: BLOCKS, icons: ICONS, maxBlocks: MAX_BLOCKS, defaultSections: defaultSections() } });
}

async function getAdminSalesPage(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json(INVALID_ID);
  if (!(await productExists(req.params.id))) return res.status(404).json(NOT_FOUND);
  return res.json({ data: await getPage(req.params.id) }); // null = página ainda não criada
}

async function saveAdminSalesPage(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json(INVALID_ID);
  if (!(await productExists(req.params.id))) return res.status(404).json(NOT_FOUND);
  try {
    const { page, created } = await savePage(req.params.id, req.body);
    return res.status(created ? 201 : 200).json({ data: page });
  } catch (error) {
    if (error instanceof PageInputError) return res.status(400).json({ error: error.message });
    throw error;
  }
}

// Pré-visualização ao vivo do editor: devolve o HTML da página com os blocos ENVIADOS, sem salvar.
async function previewAdminSalesPage(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json(INVALID_ID);
  try {
    const data = await loadDraftForRender(req.params.id, req.body);
    if (!data) return res.status(404).json(NOT_FOUND);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    return res.type("html").send(renderSalesPage(data, { baseUrl, preview: "live" }));
  } catch (error) {
    if (error instanceof PageInputError) return res.status(400).json({ error: error.message });
    throw error;
  }
}

// JSON público usado pelo protótipo pagina-vendas.html (a ser removido na limpeza da etapa 7).
async function getPublicSalesPage(req, res) {
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
  if (!result.rowCount) return res.status(404).json({ error: "Página de vendas publicada não encontrada." });
  return res.json({ data: result.rows[0] });
}

module.exports = { getBlockSchema, getAdminSalesPage, saveAdminSalesPage, previewAdminSalesPage, getPublicSalesPage };
