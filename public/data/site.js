/* ==========================================================
   DADOS DO SITE — edite aqui nome, textos e contatos.
   Os PRODUTOS vêm do banco (cadastrados no painel), não daqui.
   Campos vazios ("" ou null) são simplesmente ocultados no site.
   Os textos marcados com REVISAR são sugestões: confira antes de publicar.
   ========================================================== */
window.SITE = {
  nome: "Instituto Celetivo",
  slogan: "Conhecimento para seus próximos passos",
  // Parte do slogan que fica em laranja no título da página inicial ("" = sem destaque).
  sloganDestaque: "próximos passos",
  descricao:
    "Explore cursos e materiais digitais de diferentes áreas para desenvolver habilidades, aprofundar conhecimentos e ampliar suas oportunidades pessoais e profissionais.",

  // Página Sobre (texto separado em parágrafos por linha em branco: \n\n)
  sobre: {
    subtitulo: "Conhecimento que abre caminhos, aprendizado para diferentes áreas.",
    titulo: "Cursos e conteúdos para aprender, evoluir e colocar em prática",
    texto:
      "O Instituto Celetivo é uma plataforma de cursos e materiais de estudo voltada a pessoas que desejam adquirir novos conhecimentos, desenvolver habilidades e se preparar para os desafios do dia a dia.\n\nReunimos conteúdos de diferentes áreas, com foco em oferecer aprendizado acessível, organizado e útil, seja para quem busca aprimoramento profissional, deseja explorar novos assuntos ou quer ampliar suas oportunidades.",
    valoresTitulo: "Aprendizado pensado para você",
    valores: [
      { titulo: "Conteúdo acessível", texto: "Explicações claras e organizadas para facilitar a compreensão dos assuntos." },
      { titulo: "Conhecimento aplicável", texto: "Cursos que buscam conectar teoria e prática, ajudando você a utilizar o que aprendeu em situações reais." },
      { titulo: "Diversidade de temas", texto: "Conteúdos de diferentes áreas para atender a distintos interesses, objetivos e momentos da sua trajetória." },
      { titulo: "Aprenda no seu ritmo", texto: "Estude de acordo com sua disponibilidade e avance conforme seus objetivos." },
    ],
    proposito:
      "Acreditamos que o conhecimento é uma ferramenta para abrir oportunidades, desenvolver talentos e transformar possibilidades em conquistas. Por isso, buscamos oferecer conteúdos que contribuam para o crescimento pessoal e profissional de cada aluno.",
    chamada: {
      destaque: "Encontre seu próximo curso e comece a aprender hoje!",
      texto:
        "Descubra novos assuntos, desenvolva habilidades e encontre conteúdos alinhados aos seus objetivos. Explore nosso catálogo e dê o próximo passo na sua jornada de aprendizado.",
    },
  },

  professor: {
    nome: "", // REVISAR: nome de quem ensina (vazio = a seção não aparece)
    cargo: "",
    bio: "",
    foto: null, // ex.: "assets/images/professor.webp"
    fotoAlt: "",
  },

  contato: {
    email: "celetivo.cursos@gmail.com",
    whatsapp: "", // somente dígitos com DDI/DDD, ex.: "5511999999999"
    horario: "Respondemos em dias úteis.", // REVISAR
    redes: [
      { nome: "Instagram", url: "" }, // ex.: "https://instagram.com/perfil"
      { nome: "YouTube", url: "" },
      { nome: "LinkedIn", url: "" },
    ],
  },
};
