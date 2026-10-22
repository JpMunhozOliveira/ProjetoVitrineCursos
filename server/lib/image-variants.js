// Gera as versões menores (ver lib/images.js) das imagens enviadas antes de elas existirem
// (media.variants IS NULL). Roda em segundo plano quando o app inicia: não atrasa a subida, pode
// ser interrompido e retomado (cada imagem é marcada ao terminar) e um erro numa imagem só vai
// para o log — ela continua funcionando, só sem as versões menores.
const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../config/database");
const storage = require("./storage");
const { makeVariants } = require("./images");

async function backfillVariants() {
  const { rows } = await pool.query("SELECT id, storage_key, width FROM media WHERE variants IS NULL ORDER BY created_at");
  let done = 0;
  for (const m of rows) {
    try {
      const original = await fs.readFile(path.join(storage.UPLOAD_DIR, m.storage_key));
      const variants = await makeVariants(original, m.width);
      for (const v of variants) await storage.saveVariant(m.storage_key, v.width, v.data);
      const widths = variants.map((v) => v.width);
      const { rowCount } = await pool.query("UPDATE media SET variants = $2 WHERE id = $1", [m.id, widths]);
      // A imagem foi excluída enquanto as versões eram geradas: apaga as versões que ficaram órfãs.
      if (!rowCount) await storage.removeVariants(m.storage_key, widths);
      done++;
    } catch (error) {
      console.error(`Versões menores da imagem ${m.id}: ${error.message}`);
    }
  }
  if (rows.length) console.log(`Versões menores geradas para ${done} de ${rows.length} imagem(ns) antiga(s).`);
}

module.exports = { backfillVariants };
