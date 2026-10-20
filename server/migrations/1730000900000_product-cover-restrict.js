/* Capa do produto: o banco passa a RECUSAR excluir uma imagem que é capa (como já faz com as
   imagens das páginas de vendas). Com SET NULL, uma exclusão simultânea à troca da capa podia
   deixar o produto sem capa, sem aviso. A API já confere antes e responde 409. */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products DROP CONSTRAINT products_image_id_fkey;
    ALTER TABLE products ADD CONSTRAINT products_image_id_fkey
      FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE RESTRICT;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE products DROP CONSTRAINT products_image_id_fkey;
    ALTER TABLE products ADD CONSTRAINT products_image_id_fkey
      FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE SET NULL;
  `);
};
