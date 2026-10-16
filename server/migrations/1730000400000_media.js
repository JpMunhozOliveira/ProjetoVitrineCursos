/* Imagens enviadas pelo painel. O arquivo fica no disco (ver lib/storage.js); aqui ficam
   só os dados dele. Toda imagem é convertida para WebP no envio (ver lib/images.js). */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      storage_key VARCHAR(100) NOT NULL UNIQUE,      -- caminho relativo gerado pelo servidor
      mime_type VARCHAR(40) NOT NULL
        CONSTRAINT media_mime_type_check CHECK (mime_type = 'image/webp'),
      size_bytes INTEGER NOT NULL CONSTRAINT media_size_bytes_check CHECK (size_bytes > 0),
      width INTEGER NOT NULL CONSTRAINT media_width_check CHECK (width > 0),
      height INTEGER NOT NULL CONSTRAINT media_height_check CHECK (height > 0),
      original_name VARCHAR(255),                    -- só para exibição no painel
      alt_text VARCHAR(300),                         -- descrição para leitores de tela
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_media_created_at ON media(created_at DESC);

    -- Capa do produto. A exclusão de uma imagem em uso é bloqueada pela API; o SET NULL
    -- é só uma rede de segurança para nunca deixar um produto apontando para o vazio.
    ALTER TABLE products
      ADD COLUMN image_id UUID
        CONSTRAINT products_image_id_fkey REFERENCES media(id) ON DELETE SET NULL;
    CREATE INDEX idx_products_image_id ON products(image_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE products DROP COLUMN image_id;
    DROP TABLE media;
  `);
};
