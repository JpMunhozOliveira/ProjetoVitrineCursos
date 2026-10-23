/* Faxina:
   - description, audience, prerequisites e modules saíram do painel (o conteúdo do produto fica na
     página de vendas). Sem como editá-los, deixam de existir também no banco e no site.
   - product_integrations foi criada para a Kiwify e nunca chegou a ser usada.
   ATENÇÃO: apaga os dados dessas colunas. Faça backup antes (scripts/backup.sh). */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      DROP COLUMN description,
      DROP COLUMN audience,
      DROP COLUMN prerequisites,
      DROP COLUMN modules;

    DROP TABLE product_integrations;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_integrations (
      id UUID CONSTRAINT product_integrations_pkey PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL
        CONSTRAINT product_integrations_product_id_fkey REFERENCES products(id) ON DELETE CASCADE,
      provider VARCHAR(40) NOT NULL
        CONSTRAINT product_integrations_provider_check CHECK (provider IN ('kiwify')),
      external_product_id VARCHAR(180) NOT NULL,
      checkout_url TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        CONSTRAINT product_integrations_metadata_check CHECK (jsonb_typeof(metadata) = 'object'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT product_integrations_product_id_provider_key UNIQUE (product_id, provider),
      CONSTRAINT product_integrations_provider_external_product_id_key UNIQUE (provider, external_product_id)
    );
    CREATE INDEX idx_product_integrations_product_id ON product_integrations(product_id);

    ALTER TABLE products
      ADD COLUMN description TEXT,
      ADD COLUMN audience TEXT,
      ADD COLUMN prerequisites TEXT,
      ADD COLUMN modules JSONB NOT NULL DEFAULT '[]'::jsonb
        CONSTRAINT products_modules_check CHECK (jsonb_typeof(modules) = 'array');
  `);
};
