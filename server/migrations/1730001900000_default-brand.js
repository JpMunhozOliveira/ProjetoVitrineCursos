/* Empresa padrão (aba Empresas): o logo dela aparece no menu das páginas do site, e o ícone dela
   (ou o logo) na aba do navegador. Também vale no menu e no rodapé das páginas de vendas de
   produtos sem empresa escolhida. No máximo uma empresa é a padrão (índice único parcial). */

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE brands ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;
    CREATE UNIQUE INDEX brands_one_default ON brands ((true)) WHERE is_default;
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP INDEX brands_one_default; ALTER TABLE brands DROP COLUMN is_default;");
};
