/* Versões menores de cada imagem (480 e 960 px de largura, ver lib/images.js), para o navegador
   baixar o tamanho certo para a tela. variants = larguras já gravadas no disco ('{}' = a original
   já é pequena); NULL = ainda não processada (o app gera as que faltam ao iniciar). */

exports.up = (pgm) => {
  pgm.sql("ALTER TABLE media ADD COLUMN variants INTEGER[]");
};

exports.down = (pgm) => {
  pgm.sql("ALTER TABLE media DROP COLUMN variants");
};
