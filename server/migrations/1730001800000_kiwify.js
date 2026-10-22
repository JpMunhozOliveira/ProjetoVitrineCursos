/* Integração com a API da Kiwify (preço e link de checkout automáticos).
   - kiwify_accounts: a conta Kiwify de cada empresa (cada professor tem a sua). Fica numa tabela
     própria, fora de "brands", para as consultas do site nunca encostarem nas chaves.
     secret_enc = client_secret criptografado (AES-256-GCM, ver lib/crypto-box.js); a chave
     mestra fica só no .env (KIWIFY_ENCRYPTION_KEY).
   - products.kiwify_*: produto e link da Kiwify vinculados. price_cents e checkout_url continuam
     sendo o que o site mostra; a sincronização só os preenche. */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE kiwify_accounts (
      brand_id UUID PRIMARY KEY
        CONSTRAINT kiwify_accounts_brand_id_fkey REFERENCES brands(id) ON DELETE CASCADE,
      account_id VARCHAR(100) NOT NULL,
      client_id VARCHAR(100) NOT NULL,
      secret_enc TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE products
      ADD COLUMN kiwify_product_id VARCHAR(64),
      ADD COLUMN kiwify_link_id VARCHAR(64),
      ADD COLUMN kiwify_synced_at TIMESTAMPTZ,
      ADD COLUMN kiwify_sync_error VARCHAR(300),
      ADD CONSTRAINT products_kiwify_pair CHECK ((kiwify_product_id IS NULL) = (kiwify_link_id IS NULL));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      DROP CONSTRAINT products_kiwify_pair,
      DROP COLUMN kiwify_sync_error,
      DROP COLUMN kiwify_synced_at,
      DROP COLUMN kiwify_link_id,
      DROP COLUMN kiwify_product_id;
    DROP TABLE kiwify_accounts;
  `);
};
