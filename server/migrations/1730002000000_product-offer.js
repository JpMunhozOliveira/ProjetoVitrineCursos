/* Oferta do produto: preço "de/por" e, opcionalmente, prazo (cronômetro na página de vendas).
   - offer_price_cents / offer_checkout_url: preço e link promocionais. Com Kiwify, vêm de outro
     link do mesmo produto (offer_kiwify_link_id) e a sincronização os preenche; sem Kiwify, à mão.
   - offer_ends_at: fim da oferta (NULL = sem prazo). Depois dele o site volta sozinho ao preço e
     link normais; a decisão é do servidor a cada acesso (ver lib/offer.js). */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN offer_kiwify_link_id VARCHAR(64),
      ADD COLUMN offer_price_cents INTEGER,
      ADD COLUMN offer_checkout_url TEXT,
      ADD COLUMN offer_ends_at TIMESTAMPTZ,
      ADD CONSTRAINT products_offer_pair CHECK ((offer_price_cents IS NULL) = (offer_checkout_url IS NULL)),
      ADD CONSTRAINT products_offer_price CHECK (offer_price_cents IS NULL OR offer_price_cents BETWEEN 0 AND 100000000),
      ADD CONSTRAINT products_offer_kiwify CHECK (offer_kiwify_link_id IS NULL OR kiwify_product_id IS NOT NULL);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      DROP CONSTRAINT products_offer_kiwify,
      DROP CONSTRAINT products_offer_price,
      DROP CONSTRAINT products_offer_pair,
      DROP COLUMN offer_ends_at,
      DROP COLUMN offer_checkout_url,
      DROP COLUMN offer_price_cents,
      DROP COLUMN offer_kiwify_link_id;
  `);
};
