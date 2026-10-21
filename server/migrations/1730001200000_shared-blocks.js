/* Blocos salvos: conteúdo cadastrado uma vez (ex.: as redes sociais de um professor) e usado em
   várias páginas de vendas. A página guarda só a referência ({ type, shared: id, background });
   o conteúdo vem daqui na hora de desenhar, então alterar o bloco salvo muda todas as páginas.
   sales_page_shared_blocks registra quais páginas usam cada bloco (rascunho ou publicada), como
   sales_page_media: o banco RECUSA excluir um bloco salvo em uso (ON DELETE RESTRICT). */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE shared_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(40) NOT NULL,
      name VARCHAR(120) NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE sales_page_shared_blocks (
      sales_page_id UUID NOT NULL
        CONSTRAINT sales_page_shared_blocks_page_fkey REFERENCES sales_pages(id) ON DELETE CASCADE,
      shared_block_id UUID NOT NULL
        CONSTRAINT sales_page_shared_blocks_block_fkey REFERENCES shared_blocks(id) ON DELETE RESTRICT,
      PRIMARY KEY (sales_page_id, shared_block_id)
    );
    CREATE INDEX idx_sales_page_shared_blocks_block ON sales_page_shared_blocks(shared_block_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE sales_page_shared_blocks; DROP TABLE shared_blocks;");
};
