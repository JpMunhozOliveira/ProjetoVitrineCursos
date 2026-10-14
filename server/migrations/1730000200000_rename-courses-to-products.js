/* O catálogo passa a ter cursos e materiais digitais: "courses" vira "products".
   Renomeia também colunas, constraints e índices para os nomes ficarem coerentes
   (o nome da constraint aparece em mensagens de erro do Postgres). */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE courses RENAME TO products;
    ALTER TABLE products RENAME CONSTRAINT courses_pkey TO products_pkey;
    ALTER TABLE products RENAME CONSTRAINT courses_slug_key TO products_slug_key;
    ALTER TABLE products RENAME CONSTRAINT courses_status_check TO products_status_check;
    ALTER INDEX idx_courses_status RENAME TO idx_products_status;

    ALTER TABLE sales_pages RENAME COLUMN course_id TO product_id;
    ALTER TABLE sales_pages RENAME CONSTRAINT sales_pages_course_id_key TO sales_pages_product_id_key;
    ALTER TABLE sales_pages RENAME CONSTRAINT sales_pages_course_id_fkey TO sales_pages_product_id_fkey;

    ALTER TABLE course_integrations RENAME TO product_integrations;
    ALTER TABLE product_integrations RENAME COLUMN course_id TO product_id;
    ALTER TABLE product_integrations RENAME CONSTRAINT course_integrations_pkey TO product_integrations_pkey;
    ALTER TABLE product_integrations RENAME CONSTRAINT course_integrations_course_id_fkey TO product_integrations_product_id_fkey;
    ALTER TABLE product_integrations RENAME CONSTRAINT course_integrations_course_id_provider_key TO product_integrations_product_id_provider_key;
    ALTER TABLE product_integrations RENAME CONSTRAINT course_integrations_provider_external_product_id_key TO product_integrations_provider_external_product_id_key;
    ALTER TABLE product_integrations RENAME CONSTRAINT course_integrations_metadata_check TO product_integrations_metadata_check;
    ALTER TABLE product_integrations RENAME CONSTRAINT course_integrations_provider_check TO product_integrations_provider_check;
    ALTER INDEX idx_course_integrations_course_id RENAME TO idx_product_integrations_product_id;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER INDEX idx_product_integrations_product_id RENAME TO idx_course_integrations_course_id;
    ALTER TABLE product_integrations RENAME CONSTRAINT product_integrations_provider_check TO course_integrations_provider_check;
    ALTER TABLE product_integrations RENAME CONSTRAINT product_integrations_metadata_check TO course_integrations_metadata_check;
    ALTER TABLE product_integrations RENAME CONSTRAINT product_integrations_provider_external_product_id_key TO course_integrations_provider_external_product_id_key;
    ALTER TABLE product_integrations RENAME CONSTRAINT product_integrations_product_id_provider_key TO course_integrations_course_id_provider_key;
    ALTER TABLE product_integrations RENAME CONSTRAINT product_integrations_product_id_fkey TO course_integrations_course_id_fkey;
    ALTER TABLE product_integrations RENAME CONSTRAINT product_integrations_pkey TO course_integrations_pkey;
    ALTER TABLE product_integrations RENAME COLUMN product_id TO course_id;
    ALTER TABLE product_integrations RENAME TO course_integrations;

    ALTER TABLE sales_pages RENAME CONSTRAINT sales_pages_product_id_fkey TO sales_pages_course_id_fkey;
    ALTER TABLE sales_pages RENAME CONSTRAINT sales_pages_product_id_key TO sales_pages_course_id_key;
    ALTER TABLE sales_pages RENAME COLUMN product_id TO course_id;

    ALTER INDEX idx_products_status RENAME TO idx_courses_status;
    ALTER TABLE products RENAME CONSTRAINT products_status_check TO courses_status_check;
    ALTER TABLE products RENAME CONSTRAINT products_slug_key TO courses_slug_key;
    ALTER TABLE products RENAME CONSTRAINT products_pkey TO courses_pkey;
    ALTER TABLE products RENAME TO courses;
  `);
};
