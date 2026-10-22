// Cria (ou atualiza) o usuário do banco que o app usa no dia a dia, com permissões mínimas:
// ler e gravar dados nas tabelas, sem poder criar, alterar ou apagar tabelas, nem mexer em outros
// usuários. O usuário dono (POSTGRES_USER) fica só para as migrations e os backups.
// Roda depois das migrations a cada subida (serviço "migrate"), então tabelas novas já recebem a
// permissão, e trocar APP_DB_PASSWORD no .env atualiza a senha no banco.
const { Client } = require("pg");

const user = process.env.APP_DB_USER;
const password = process.env.APP_DB_PASSWORD;

function fail(message) {
  console.error(`app-db-role: ${message}`);
  process.exit(1);
}

if (!user || !/^[a-z_][a-z0-9_]{0,62}$/.test(user)) fail("APP_DB_USER ausente ou inválido (use letras minúsculas, números e _).");
if (!password || password.length < 16) fail("APP_DB_PASSWORD ausente ou curta (mínimo 16 caracteres).");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: [me] } = await client.query("SELECT current_user AS name, current_database() AS db");
    if (me.name === user) fail("APP_DB_USER precisa ser diferente de POSTGRES_USER (o dono do banco).");

    // Comandos de usuário/permissão não aceitam $1; os nomes passam pelo escape do próprio pg.
    const role = client.escapeIdentifier(user);
    const pass = client.escapeLiteral(password);
    const { rowCount: exists } = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [user]);
    const limits = "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS";
    await client.query(exists
      ? `ALTER ROLE ${role} WITH ${limits} PASSWORD ${pass}`
      : `CREATE ROLE ${role} WITH ${limits} PASSWORD ${pass}`);

    await client.query(`GRANT CONNECT ON DATABASE ${client.escapeIdentifier(me.db)} TO ${role}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await client.query(`REVOKE CREATE ON SCHEMA public FROM ${role}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
    // O controle das migrations não é assunto do app.
    await client.query(`DO $$ BEGIN
      IF to_regclass('public.pgmigrations') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON TABLE public.pgmigrations FROM ${role.replace(/'/g, "''")}';
      END IF; END $$`);

    console.log(`app-db-role: usuário "${user}" ${exists ? "atualizado" : "criado"} com permissões mínimas.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => fail(error.message));
