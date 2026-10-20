/* ==========================================================
   DADOS DO SITE — edite aqui nome, textos e contatos.
   Os PRODUTOS vêm do banco (cadastrados no painel), não daqui.
   Campos vazios ("" ou null) são simplesmente ocultados no site.
   Os textos marcados com REVISAR são sugestões: confira antes de publicar.
   ========================================================== */
window.SITE = {
  nome: "Estratégia Contábil Digital",
  slogan: "Atualização contábil e tributária, direto ao ponto",
  descricao:
    "Cursos e materiais digitais para contadores e profissionais da área fiscal se atualizarem com segurança, começando pela Reforma Tributária do Consumo.",

  // Página Sobre (REVISAR)
  sobre: {
    titulo: "Conhecimento técnico, explicado para quem aplica no dia a dia",
    texto:
      "A Estratégia Contábil Digital produz cursos e materiais de estudo para profissionais da contabilidade e da área fiscal.\n\nNosso foco é transformar mudanças na legislação em conteúdo claro, organizado e pronto para consulta, para que você entenda o que muda, por que muda e como aplicar no trabalho.",
    valores: [
      { titulo: "Direto ao ponto", texto: "Conteúdo organizado em etapas curtas, sem enrolação." },
      { titulo: "Fundamentado", texto: "Explicações baseadas na legislação e na regulamentação vigentes." },
      { titulo: "Feito para consulta", texto: "Resumos, quadros e exemplos para voltar sempre que precisar." },
    ],
  },

  professor: {
    nome: "", // REVISAR: nome de quem ensina (vazio = a seção não aparece)
    cargo: "",
    bio: "",
    foto: null, // ex.: "assets/images/professor.webp"
    fotoAlt: "",
  },

  contato: {
    email: "contato@exemplo.com", // REVISAR
    whatsapp: "", // somente dígitos com DDI/DDD, ex.: "5511999999999"
    horario: "Respondemos em dias úteis.", // REVISAR
    redes: [
      { nome: "Instagram", url: "" }, // ex.: "https://instagram.com/perfil"
      { nome: "YouTube", url: "" },
      { nome: "LinkedIn", url: "" },
    ],
  },
};
