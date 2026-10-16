/* Administradores do painel e suas sessões (token guardado apenas como hash). */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(254) NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX admin_users_email_key ON admin_users (lower(email));

    CREATE TABLE admin_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS admin_sessions; DROP TABLE IF EXISTS admin_users;`);
};
