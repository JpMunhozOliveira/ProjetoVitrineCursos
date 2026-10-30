/* Selo do cartão do produto no catálogo e no início (Editar produto > Selo no cartão):
   - available: "Acesso imediato" (verde, padrão);
   - last_chance: "Última chance" (vermelho), para quando a venda está acabando;
   - new: "Novidade" (dourado), para lançamentos;
   - none: sem selo. */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN card_badge VARCHAR(20) NOT NULL DEFAULT 'available'
        CONSTRAINT products_card_badge_check CHECK (card_badge IN ('available', 'last_chance', 'new', 'none'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE products DROP COLUMN card_badge;`);
};
