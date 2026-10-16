const pool = require("../config/database");
const storage = require("../lib/storage");
const { detectType, processImage } = require("../lib/images");

// "usage": onde a imagem é usada — como capa de produto ("cover") ou dentro de uma página de
// vendas ("page"). O painel mostra essa lista e a exclusão de imagem em uso é bloqueada.
const SELECT_MEDIA = `
  SELECT m.id, m.storage_key, m.mime_type, m.size_bytes, m.width, m.height,
         m.original_name, m.alt_text, m.created_at,
         COALESCE((SELECT json_agg(u ORDER BY u.title) FROM (
             SELECT p.id, p.title, 'cover' AS kind FROM products p WHERE p.image_id = m.id
             UNION ALL
             SELECT p.id, p.title, 'page' AS kind
               FROM sales_page_media spm
               JOIN sales_pages sp ON sp.id = spm.sales_page_id
               JOIN products p ON p.id = sp.product_id
              WHERE spm.media_id = m.id
           ) u), '[]') AS usage
    FROM media m`;

const USAGE_LABEL = { cover: "capa de", page: "página de vendas de" };

// Troca a chave interna pela URL pública; o caminho no disco não sai do servidor.
function toResponse({ storage_key, ...media }) {
  return { ...media, url: storage.publicUrl(storage_key) };
}

function isValidId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeAlt(value) {
  if (value !== null && typeof value !== "string") return { error: "alt_text deve ser texto ou null." };
  const alt = value?.trim() || null;
  if (alt && alt.length > 300) return { error: "O texto alternativo deve ter no máximo 300 caracteres." };
  return { alt };
}

// Nome original vem no cabeçalho X-File-Name (codificado com encodeURIComponent).
// Serve só para exibição: o arquivo é gravado com um nome aleatório.
function originalName(req) {
  try {
    const name = decodeURIComponent(req.get("x-file-name") || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
    return name.slice(0, 255) || null;
  } catch {
    return null;
  }
}

const NOT_FOUND = { error: "Imagem não encontrada." };

async function uploadMedia(req, res) {
  // express.raw só preenche o corpo para os tipos aceitos; qualquer outro chega como {}.
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(415).json({ error: "Envie uma imagem PNG, JPEG ou WebP." });
  }
  if (!detectType(req.body)) {
    return res.status(415).json({ error: "O arquivo não é uma imagem PNG, JPEG ou WebP válida." });
  }

  let image;
  try {
    image = await processImage(req.body);
  } catch {
    return res.status(400).json({ error: "Não foi possível ler esta imagem (arquivo corrompido ou grande demais)." });
  }

  const key = await storage.save(image.data);
  try {
    const { rows } = await pool.query(
      `WITH m AS (
         INSERT INTO media (storage_key, mime_type, size_bytes, width, height, original_name)
         VALUES ($1, 'image/webp', $2, $3, $4, $5) RETURNING *)
       SELECT m.id, m.storage_key, m.mime_type, m.size_bytes, m.width, m.height,
              m.original_name, m.alt_text, m.created_at, '[]'::json AS usage FROM m`,
      [key, image.size, image.width, image.height, originalName(req)]
    );
    return res.status(201).json({ data: toResponse(rows[0]) });
  } catch (error) {
    await storage.remove(key); // não deixa arquivo órfão no disco se o banco falhar
    throw error;
  }
}

async function listMedia(_req, res) {
  const { rows } = await pool.query(`${SELECT_MEDIA} ORDER BY m.created_at DESC`);
  return res.json({ data: rows.map(toResponse) });
}

async function updateMedia(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);
  const body = req.body;
  const keys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body) : null;
  if (!keys || keys.length !== 1 || keys[0] !== "alt_text") {
    return res.status(400).json({ error: "Envie apenas o campo alt_text." });
  }
  const { alt, error } = normalizeAlt(body.alt_text);
  if (error) return res.status(400).json({ error });

  const updated = await pool.query("UPDATE media SET alt_text = $2 WHERE id = $1", [req.params.id, alt]);
  if (!updated.rowCount) return res.status(404).json(NOT_FOUND);

  const { rows } = await pool.query(`${SELECT_MEDIA} WHERE m.id = $1`, [req.params.id]);
  return res.json({ data: toResponse(rows[0]) });
}

// Exclusão bloqueada se a imagem estiver em uso: apagar em silêncio deixaria o produto sem capa
// ou a página de vendas com um buraco. (O banco também recusa, via ON DELETE RESTRICT.)
async function deleteMedia(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json(NOT_FOUND);

  const { rows } = await pool.query(
    `DELETE FROM media m
      WHERE m.id = $1
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.image_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM sales_page_media spm WHERE spm.media_id = m.id)
      RETURNING m.storage_key`,
    [req.params.id]
  );
  if (rows.length) {
    await storage.remove(rows[0].storage_key);
    return res.status(204).end();
  }

  const found = await pool.query(`${SELECT_MEDIA} WHERE m.id = $1`, [req.params.id]);
  if (!found.rowCount) return res.status(404).json(NOT_FOUND);
  const where = found.rows[0].usage.map((u) => `${USAGE_LABEL[u.kind]} “${u.title}”`).join(", ");
  return res.status(409).json({ error: `Esta imagem está em uso (${where}). Troque-a nesses lugares antes de excluí-la.` });
}

module.exports = { uploadMedia, listMedia, updateMedia, deleteMedia };
