/* Faxina: headline e subheadline eram do protótipo de página de vendas (removido). Hoje o
   título e a chamada ficam no bloco "Abertura" (sections). */

exports.up = (pgm) => {
  pgm.sql("ALTER TABLE sales_pages DROP COLUMN headline, DROP COLUMN subheadline;");
};

exports.down = (pgm) => {
  pgm.sql("ALTER TABLE sales_pages ADD COLUMN headline VARCHAR(220), ADD COLUMN subheadline TEXT;");
};
