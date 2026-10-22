#!/usr/bin/env node
// Cria o .env a partir do .env.example com segredos aleatórios (não imprime os valores).
// Uso:  node scripts/gerar-env.js          (sem .env: cria; com .env: só acrescenta as variáveis que faltam)
//       node scripts/gerar-env.js --force  (sobrescreve: com o banco já criado, a senha nova do Postgres não vale para o volume existente)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const target = path.join(root, ".env");

const random = (bytes) => crypto.randomBytes(bytes).toString("hex");
const generated = { POSTGRES_PASSWORD: random(24), APP_DB_PASSWORD: random(24), ADMIN_API_KEY: random(32) };
const keyOf = (line) => line.match(/^([A-Z_]+)=/)?.[1];

const example = fs.readFileSync(path.join(root, ".env.example"), "utf8").split(/\r?\n/);
const withSecrets = (line) => {
  const key = keyOf(line);
  return key && generated[key] ? `${key}=${generated[key]}` : line;
};

if (fs.existsSync(target) && !process.argv.includes("--force")) {
  // .env existente: mantém tudo e acrescenta só as variáveis novas do .env.example.
  const current = fs.readFileSync(target, "utf8");
  const have = new Set(current.split(/\r?\n/).map(keyOf).filter(Boolean));
  const missing = example.filter((line) => keyOf(line) && !have.has(keyOf(line))).map(withSecrets);
  if (!missing.length) {
    console.log(".env já existe e está completo. Use --force para recriá-lo (os valores atuais serão perdidos).");
    process.exit(0);
  }
  const sep = current.endsWith("\n") || !current ? "" : "\n";
  fs.appendFileSync(target, `${sep}\n# Acrescentado por scripts/gerar-env.js\n${missing.join("\n")}\n`);
  console.log(`.env atualizado. Variáveis acrescentadas: ${missing.map(keyOf).join(", ")}.`);
  process.exit(0);
}

fs.writeFileSync(target, example.map(withSecrets).join("\n"), { mode: 0o600 });
console.log(".env criado com POSTGRES_PASSWORD, APP_DB_PASSWORD e ADMIN_API_KEY aleatórios.");
console.log("Abra o arquivo para ver a ADMIN_API_KEY e guardá-la em local seguro.");
