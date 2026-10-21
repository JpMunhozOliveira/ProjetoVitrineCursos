#!/usr/bin/env node
// Cria o .env a partir do .env.example com segredos aleatórios (não imprime os valores).
// Uso:  node scripts/gerar-env.js          (recusa sobrescrever um .env existente)
//       node scripts/gerar-env.js --force  (sobrescreve: com o banco já criado, a senha nova do Postgres não vale para o volume existente)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const target = path.join(root, ".env");

if (fs.existsSync(target) && !process.argv.includes("--force")) {
  console.error(".env já existe. Use --force para sobrescrever (os valores atuais serão perdidos).");
  process.exit(1);
}

const random = (bytes) => crypto.randomBytes(bytes).toString("hex");
const generated = { POSTGRES_PASSWORD: random(24), ADMIN_API_KEY: random(32) };

const lines = fs
  .readFileSync(path.join(root, ".env.example"), "utf8")
  .split(/\r?\n/)
  .map((line) => {
    const match = line.match(/^([A-Z_]+)=/);
    return match && generated[match[1]] ? `${match[1]}=${generated[match[1]]}` : line;
  });

fs.writeFileSync(target, lines.join("\n"), { mode: 0o600 });
console.log(".env criado com POSTGRES_PASSWORD e ADMIN_API_KEY aleatórios.");
console.log("Abra o arquivo para ver a ADMIN_API_KEY e guardá-la em local seguro.");
