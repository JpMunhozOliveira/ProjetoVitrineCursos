const pool = require("../config/database");
const { BLOCKS, ICONS, MAX_BLOCKS, defaultSections } = require("../sales/blocks");
const { THEMES, DEFAULT_THEME } = require("../sales/theme");
const { PageInputError, savePage, publishPage, getPage, loadDraftForRender } = require("../sales/pages");
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
  return res.json({ data: {
    blocks: BLOCKS, icons: ICONS, maxBlocks: MAX_BLOCKS, defaultSections: defaultSections(),
    themes: THEMES, defaultTheme: DEFAULT_THEME,
  } });
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

// Publica: a versão pública passa a ser o rascunho SALVO (o editor salva antes, se preciso).
async function publishAdminSalesPage(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json(INVALID_ID);
  if (!(await productExists(req.params.id))) return res.status(404).json(NOT_FOUND);
  const page = await publishPage(req.params.id);
  if (!page) return res.status(409).json({ error: "Salve a página antes de publicá-la." });
  return res.json({ data: page });
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

module.exports = { getBlockSchema, getAdminSalesPage, saveAdminSalesPage, publishAdminSalesPage, previewAdminSalesPage };
