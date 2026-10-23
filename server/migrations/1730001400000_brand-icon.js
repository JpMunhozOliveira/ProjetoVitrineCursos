/* Ícone da aba do navegador (favicon) da empresa, usado nas páginas de vendas dos produtos dela.
   Opcional: vazio = usa o logo; sem logo = ícone do site. Um ícone próprio (quadrado) fica melhor
   quando o logo é largo, porque a aba mostra uma imagem bem pequena e quadrada.
   Mesma regra do logo: o banco recusa excluir uma imagem em uso. */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE brands
      ADD COLUMN icon_id UUID CONSTRAINT brands_icon_id_fkey REFERENCES media(id) ON DELETE RESTRICT;
    CREATE INDEX idx_brands_icon_id ON brands(icon_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP INDEX idx_brands_icon_id; ALTER TABLE brands DROP COLUMN icon_id;");
};
