/* Campos que o site já exibe (hoje vindos de public/data/cursos.js) e que o
   painel precisa cadastrar. Imagem fica para a etapa de uploads. */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN category VARCHAR(80),
      ADD COLUMN featured BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN description TEXT,
      ADD COLUMN audience TEXT,
      ADD COLUMN prerequisites TEXT,
      ADD COLUMN modules JSONB NOT NULL DEFAULT '[]'::jsonb
        CONSTRAINT products_modules_check CHECK (jsonb_typeof(modules) = 'array'),
      ADD COLUMN format VARCHAR(120),
      ADD COLUMN workload VARCHAR(60),
      -- Preço em centavos (inteiro): evita erros de arredondamento de números decimais.
      ADD COLUMN price_cents INTEGER
        CONSTRAINT products_price_cents_check CHECK (price_cents >= 0),
      ADD COLUMN checkout_url TEXT
        CONSTRAINT products_checkout_url_check CHECK (checkout_url ~ '^https://');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      DROP COLUMN checkout_url,
      DROP COLUMN price_cents,
      DROP COLUMN workload,
      DROP COLUMN format,
      DROP COLUMN modules,
      DROP COLUMN prerequisites,
      DROP COLUMN audience,
      DROP COLUMN description,
      DROP COLUMN featured,
      DROP COLUMN category;
  `);
};
