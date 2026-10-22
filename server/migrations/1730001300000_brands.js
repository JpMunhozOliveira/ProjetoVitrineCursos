/* Empresas (aba "Empresas" do painel): nome e logo cadastrados uma vez e escolhidos em cada produto.
   Antes ficavam copiados em cada produto (brand_name / brand_logo_id); trocar o logo exigia editar
   produto por produto. Agora o produto guarda só brand_id, e a página de vendas e o catálogo leem a
   empresa na hora: alterar a empresa muda todos os produtos dela, inclusive páginas já publicadas.
   - Nome vazio vale (só logo), como antes; ao menos um dos dois é obrigatório.
   - O banco recusa excluir uma empresa em uso (ON DELETE RESTRICT) e uma imagem usada como logo.
   - Dados atuais: cada par distinto (nome, logo) vira uma empresa e os produtos são ligados a ela. */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE brands (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(80),
      logo_id UUID CONSTRAINT brands_logo_id_fkey REFERENCES media(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT brands_name_or_logo CHECK (name IS NOT NULL OR logo_id IS NOT NULL)
    );
    CREATE INDEX idx_brands_logo_id ON brands(logo_id);

    ALTER TABLE products
      ADD COLUMN brand_id UUID CONSTRAINT products_brand_id_fkey REFERENCES brands(id) ON DELETE RESTRICT;
    CREATE INDEX idx_products_brand_id ON products(brand_id);

    INSERT INTO brands (name, logo_id)
      SELECT DISTINCT brand_name, brand_logo_id FROM products
       WHERE brand_name IS NOT NULL OR brand_logo_id IS NOT NULL;
    UPDATE products p SET brand_id = b.id
      FROM brands b
     WHERE b.name IS NOT DISTINCT FROM p.brand_name AND b.logo_id IS NOT DISTINCT FROM p.brand_logo_id
       AND (p.brand_name IS NOT NULL OR p.brand_logo_id IS NOT NULL);

    DROP INDEX idx_products_brand_logo_id;
    ALTER TABLE products DROP COLUMN brand_logo_id, DROP COLUMN brand_name;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN brand_name VARCHAR(80),
      ADD COLUMN brand_logo_id UUID
        CONSTRAINT products_brand_logo_id_fkey REFERENCES media(id) ON DELETE RESTRICT;
    CREATE INDEX idx_products_brand_logo_id ON products(brand_logo_id);

    UPDATE products p SET brand_name = b.name, brand_logo_id = b.logo_id
      FROM brands b WHERE b.id = p.brand_id;

    DROP INDEX idx_products_brand_id;
    ALTER TABLE products DROP COLUMN brand_id;
    DROP TABLE brands;
  `);
};
