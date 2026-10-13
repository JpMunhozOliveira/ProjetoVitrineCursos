/* Initial schema for course catalog and editable sales pages. */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(180) NOT NULL,
      slug VARCHAR(180) NOT NULL UNIQUE,
      short_description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE sales_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL UNIQUE
        REFERENCES courses(id) ON DELETE CASCADE,
      headline VARCHAR(220),
      subheadline TEXT,
      sections JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(sections) = 'array'),
      seo_title VARCHAR(220),
      seo_description VARCHAR(320),
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE course_integrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL
        REFERENCES courses(id) ON DELETE CASCADE,
      provider VARCHAR(40) NOT NULL
        CHECK (provider IN ('kiwify')),
      external_product_id VARCHAR(180) NOT NULL,
      checkout_url TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (course_id, provider),
      UNIQUE (provider, external_product_id)
    );

    CREATE INDEX idx_courses_status ON courses(status);
    CREATE INDEX idx_course_integrations_course_id
      ON course_integrations(course_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS course_integrations;
    DROP TABLE IF EXISTS sales_pages;
    DROP TABLE IF EXISTS courses;
  `);
};
