// Criptografia de segredos guardados no banco (hoje: o client_secret de cada conta Kiwify).
// AES-256-GCM: além de esconder o texto, detecta qualquer alteração (a tag de autenticação falha).
// A chave mestra fica só no .env (KIWIFY_ENCRYPTION_KEY, 32 bytes em base64); um backup do banco
// vazado não revela os segredos. "context" (ex.: o id da empresa) amarra o segredo à sua linha:
// copiar o segredo de uma empresa para outra no banco faz a leitura falhar.
const crypto = require("node:crypto");

const VERSION = "v1";

function masterKey() {
  const key = Buffer.from(process.env.KIWIFY_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) {
    const error = new Error("KIWIFY_ENCRYPTION_KEY ausente ou inválida no servidor (gere com: node scripts/gerar-env.js).");
    error.code = "NO_MASTER_KEY";
    throw error;
  }
  return key;
}

function isConfigured() {
  try { masterKey(); return true; } catch { return false; }
}

const b64 = (buf) => buf.toString("base64url");

function encrypt(text, context, key = masterKey()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(String(context)));
  const data = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(data)].join(".");
}

function decrypt(box, context, key = masterKey()) {
  const [version, iv, tag, data] = String(box).split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error("Segredo em formato desconhecido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(String(context)));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Não foi possível abrir o segredo (chave mestra trocada ou dado alterado).");
  }
}

module.exports = { encrypt, decrypt, isConfigured, masterKey };
