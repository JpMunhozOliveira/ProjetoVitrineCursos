/* Cores da página de vendas: { "preset": "marinho" } ou
   { "preset": "custom", "hero": "#RRGGBB", "accent": "#RRGGBB" } (ver server/sales/theme.js).
   Paletas prontas são guardadas só pelo nome: se a paleta for ajustada, as páginas acompanham. */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE sales_pages
      ADD COLUMN theme JSONB NOT NULL DEFAULT '{}'::jsonb
        CONSTRAINT sales_pages_theme_check CHECK (jsonb_typeof(theme) = 'object');
  `);
};

exports.down = (pgm) => {
  pgm.sql("ALTER TABLE sales_pages DROP COLUMN theme;");
};
