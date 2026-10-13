/* ==========================================================
   DADOS DO SITE — edite aqui nome, textos, contatos e cursos.
   Tudo abaixo é PLACEHOLDER. Campos vazios ("" ou null) são
   simplesmente ocultados no site.
   ========================================================== */
window.SITE = {
  nome: "Nome da Marca",
  slogan: "Aprenda com quem ensina na prática",
  descricao:
    "Cursos online do Professor Nome Sobrenome. Conheça o catálogo e comece hoje.",
  professor: {
    nome: "Nome do Professor",
    bio: "Escreva aqui uma biografia curta: formação, experiência e o que motiva seus cursos. (Texto placeholder.)",
    foto: null, // ex.: "assets/images/professor.webp"
    fotoAlt: "",
  },
  contato: {
    email: "contato@exemplo.com",
    whatsapp: "", // somente dígitos com DDI/DDD, ex.: "5511999999999"
    redes: [
      { nome: "Instagram", url: "" }, // ex.: "https://instagram.com/perfil"
      { nome: "YouTube", url: "" },
    ],
  },
};

window.CURSOS = [
  {
    id: "reforma-tributaria",
    pagina: "curso-reforma-tributaria.html",
    categoria: "Coleção Manuais Práticos", // usada no filtro do catálogo (opcional)
    destaque: true, // true = aparece na página inicial                 // usado na URL: curso.html?id=curso-exemplo-1
    titulo: "Manual Prático da Reforma Tributária do Consumo",
    resumo: "Manual desenvolvido para profissionais que precisam consultar rapidamente IBS, CBS, Split Payment, DF-e, Apuração Assistida e Escrituração do IVA Dual.",
    imagem: "assets/images/cover-reforma.png", // ex.: "assets/images/curso-1.webp"
    imagemAlt: "",
    publico: "Para quem está começando e quer uma base sólida.",
    preRequisitos: "Nenhum conhecimento prévio.",
    cargaHoraria: null, // ex.: "20 horas"
    preco: null, // número (ex.: 197) ou null para ocultar
    checkoutUrl: "https://pay.kiwify.com.br/2IDvyM2", // precisa começar com https://
  },
  {
    id: "curso-exemplo-2",
    categoria: "Categoria B",
    destaque: true,
    titulo: "Curso de Exemplo 2",
    resumo: "Outro resumo curto, focado no principal benefício do curso.",
    descricao: "Descrição completa do segundo curso.",
    imagem: null,
    imagemAlt: "",
    publico: "Para quem já tem experiência e quer se aprofundar.",
    preRequisitos: "",
    conteudo: ["Módulo 1", "Módulo 2", "Módulo 3", "Módulo 4"],
    formato: "",
    cargaHoraria: null,
    preco: null,
    checkoutUrl: "INSERIR_URL_OFICIAL_DO_CHECKOUT",
  },
  {
    id: "curso-exemplo-3",
    categoria: "Categoria A",
    destaque: false,
    titulo: "Curso de Exemplo 3",
    resumo: "Mais um resumo de exemplo para ilustrar o catálogo.",
    descricao: "Descrição completa do terceiro curso.",
    imagem: null,
    imagemAlt: "",
    publico: "Para quem busca aplicar o conteúdo no dia a dia.",
    preRequisitos: "",
    conteudo: ["Módulo 1", "Módulo 2"],
    formato: "",
    cargaHoraria: null,
    preco: null,
    checkoutUrl: "INSERIR_URL_OFICIAL_DO_CHECKOUT",
  },
];
