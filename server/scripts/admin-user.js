// Cria um administrador ou redefine a senha de um existente (encerra as sessões dele).
//   docker compose run --rm app node scripts/admin-user.js [email]
//   echo "senha" | docker compose run --rm -T app node scripts/admin-user.js email --password-stdin
const readline = require("node:readline/promises");
const pool = require("../config/database");
const { hashPassword } = require("../lib/security");

function askHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let value = "";
    process.stdout.write(prompt);
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(130); }
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData);
          process.stdout.write("\n"); return resolve(value);
        }
        value = c === "\u007f" || c === "\b" ? value.slice(0, -1) : value + c;
      }
    };
    stdin.on("data", onData);
  });
}

function readStdinLine() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data.split(/\r?\n/)[0]));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const fromStdin = args.includes("--password-stdin") || !process.stdin.isTTY;
  let email = args.find((a) => !a.startsWith("--"));
  if (!email) {
    if (fromStdin) throw new Error("Informe o e-mail como argumento.");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    email = await rl.question("E-mail do administrador: ");
    rl.close();
  }
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("E-mail inválido.");

  let password;
  if (fromStdin) password = await readStdinLine();
  else {
    password = await askHidden("Senha (mínimo 12 caracteres): ");
    if (password !== (await askHidden("Repita a senha: "))) throw new Error("As senhas não conferem.");
  }
  if (password.length < 12 || password.length > 128) throw new Error("A senha deve ter entre 12 e 128 caracteres.");

  const { rows } = await pool.query(
    `INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT ((lower(email))) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, (xmax = 0) AS created`,
    [email, await hashPassword(password)]);
  if (!rows[0].created) await pool.query("DELETE FROM admin_sessions WHERE user_id = $1", [rows[0].id]);
  console.log(rows[0].created ? `Administrador criado: ${email}` : `Senha redefinida: ${email}`);
}

main().catch((e) => { console.error("Erro:", e.message); process.exitCode = 1; }).finally(() => pool.end());
