/* Imagens usadas dentro das páginas de vendas (galeria, foto do autor, mockups...).
   As imagens ficam dentro do JSON "sections"; esta tabela registra quais são, para:
   - mostrar na biblioteca onde cada imagem é usada;
   - o banco RECUSAR excluir uma imagem em uso (ON DELETE RESTRICT), mesmo que algum código esqueça de conferir.
   É regravada pela API a cada vez que a página é salva (ver server/sales/pages.js). */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE sales_page_media (
      sales_page_id UUID NOT NULL
        CONSTRAINT sales_page_media_page_fkey REFERENCES sales_pages(id) ON DELETE CASCADE,
      media_id UUID NOT NULL
        CONSTRAINT sales_page_media_media_fkey REFERENCES media(id) ON DELETE RESTRICT,
      PRIMARY KEY (sales_page_id, media_id)
    );
    CREATE INDEX idx_sales_page_media_media_id ON sales_page_media(media_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE sales_page_media;");
};
