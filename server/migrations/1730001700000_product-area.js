/* Área de conhecimento do produto (ex.: Contabilidade, Tributário, Gestão). Texto livre, opcional:
   a página inicial lista as áreas que têm produtos publicados e o catálogo filtra por ela. */

exports.up = (pgm) => {
  pgm.sql("ALTER TABLE products ADD COLUMN area VARCHAR(60);");
};

exports.down = (pgm) => {
  pgm.sql("ALTER TABLE products DROP COLUMN area;");
};
