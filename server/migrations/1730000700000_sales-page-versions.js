/* Versões da página de vendas: o que se edita (sections, seo_*, theme = RASCUNHO) e o que o
   público vê (published_* = cópia congelada no momento em que se clicou em "Publicar").
   - Salvar grava só o rascunho: editar uma página no ar não muda o site até publicar.
   - published_at passa a ser a data da última publicação (null = nunca publicada).
   - Páginas que já estavam publicadas continuam no ar: a versão atual vira a publicada. */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE sales_pages
      ADD COLUMN published_sections JSONB
        CONSTRAINT sales_pages_published_sections_check CHECK (jsonb_typeof(published_sections) = 'array'),
      ADD COLUMN published_seo_title VARCHAR(220),
      ADD COLUMN published_seo_description VARCHAR(320),
      ADD COLUMN published_theme JSONB
        CONSTRAINT sales_pages_published_theme_check CHECK (jsonb_typeof(published_theme) = 'object');

    UPDATE sales_pages
       SET published_sections = sections, published_seo_title = seo_title,
           published_seo_description = seo_description, published_theme = theme
     WHERE published_at IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE sales_pages
      DROP COLUMN published_theme, DROP COLUMN published_seo_description,
      DROP COLUMN published_seo_title, DROP COLUMN published_sections;
  `);
};
