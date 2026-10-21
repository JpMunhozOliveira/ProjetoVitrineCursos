/* Marca do produto e fim do SEO separado da página de vendas.
   - O título e a descrição para buscadores e prévias de link deixam de ser campos próprios: são
     sempre o título e o resumo (short_description) do produto, editados em "Editar produto".
   - brand_name / brand_logo_id: marca da empresa do professor, mostrada na navbar e no rodapé
     da página de vendas. O logo segue a regra da capa: o banco recusa excluir uma imagem em uso. */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN brand_name VARCHAR(80),
      ADD COLUMN brand_logo_id UUID
        CONSTRAINT products_brand_logo_id_fkey REFERENCES media(id) ON DELETE RESTRICT;
    CREATE INDEX idx_products_brand_logo_id ON products(brand_logo_id);

    ALTER TABLE sales_pages
      DROP COLUMN seo_title, DROP COLUMN seo_description,
      DROP COLUMN published_seo_title, DROP COLUMN published_seo_description;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE sales_pages
      ADD COLUMN seo_title VARCHAR(220),
      ADD COLUMN seo_description VARCHAR(320),
      ADD COLUMN published_seo_title VARCHAR(220),
      ADD COLUMN published_seo_description VARCHAR(320);

    DROP INDEX idx_products_brand_logo_id;
    ALTER TABLE products
      DROP COLUMN brand_logo_id, DROP COLUMN brand_name;
  `);
};
