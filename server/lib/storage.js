// Armazenamento dos arquivos enviados. Hoje: pasta local (volume do Docker).
// Para usar S3/R2 no futuro, basta reimplementar estas funções mantendo a mesma interface.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads"));
const PUBLIC_PREFIX = "/uploads/";

// Chave = "ab/ab12...ef.webp": nome aleatório gerado aqui (nunca o nome enviado pelo usuário),
// em subpastas pelos 2 primeiros caracteres para não juntar milhares de arquivos numa pasta só.
const KEY_PATTERN = /^[0-9a-f]{2}\/[0-9a-f]{32}\.webp$/;

function resolveKey(key) {
  if (!KEY_PATTERN.test(key)) throw new Error(`Chave de arquivo inválida: ${key}`);
  return path.join(UPLOAD_DIR, key);
}

async function save(buffer) {
  const name = crypto.randomBytes(16).toString("hex");
  const key = `${name.slice(0, 2)}/${name}.webp`;
  const file = resolveKey(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer, { flag: "wx" }); // "wx": falha em vez de sobrescrever
  return key;
}

async function remove(key) {
  try {
    await fs.unlink(resolveKey(key));
  } catch (error) {
    if (error.code !== "ENOENT") throw error; // já não existe: objetivo alcançado
  }
}

const publicUrl = (key) => PUBLIC_PREFIX + key;

module.exports = { UPLOAD_DIR, save, remove, publicUrl };
