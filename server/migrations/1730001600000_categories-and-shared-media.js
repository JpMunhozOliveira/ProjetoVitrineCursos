/* 1) Categoria do produto passa a ser uma lista fixa (Curso, Guia, Manual; ver lib/categories.js).
      Os valores livres de antes são convertidos pelo nome; o que não se encaixa fica sem categoria.
      O "down" não devolve os textos antigos (só remove a tabela abaixo).
   2) shared_block_media: imagens usadas por blocos salvos (ex.: a foto do bloco salvo de Autor),
      como sales_page_media faz para as páginas. O banco RECUSA excluir uma imagem em uso. */

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE products SET category = CASE
        WHEN category ILIKE '%manua%' THEN 'Manual'
        WHEN category ILIKE '%guia%' THEN 'Guia'
        WHEN category ILIKE '%curso%' THEN 'Curso'
        ELSE NULL END
      WHERE category IS NOT NULL;

    CREATE TABLE shared_block_media (
      shared_block_id UUID NOT NULL
        CONSTRAINT shared_block_media_block_fkey REFERENCES shared_blocks(id) ON DELETE CASCADE,
      media_id UUID NOT NULL
        CONSTRAINT shared_block_media_media_fkey REFERENCES media(id) ON DELETE RESTRICT,
      PRIMARY KEY (shared_block_id, media_id)
    );
    CREATE INDEX idx_shared_block_media_media ON shared_block_media(media_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE shared_block_media;");
};
