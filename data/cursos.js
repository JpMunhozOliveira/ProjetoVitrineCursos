/* ==========================================================
   DADOS DO SITE — edite aqui nome, textos, contatos e cursos.
   Tudo abaixo é PLACEHOLDER. Campos vazios ("" ou null) são
   simplesmente ocultados no site.
   ========================================================== */
window.SITE = {
  nome: "Nome da Marca",
  slogan: "Aprenda com quem ensina na prática",
  descricao: "Cursos online do Professor Nome Sobrenome. Conheça o catálogo e comece hoje.",
  professor: {
    nome: "Nome do Professor",
    bio: "Escreva aqui uma biografia curta: formação, experiência e o que motiva seus cursos. (Texto placeholder.)",
    foto: null,            // ex.: "assets/images/professor.webp"
    fotoAlt: ""
  },
  contato: {
    email: "contato@exemplo.com",
    whatsapp: "",          // somente dígitos com DDI/DDD, ex.: "5511999999999"
    redes: [
      { nome: "Instagram", url: "" },   // ex.: "https://instagram.com/perfil"
      { nome: "YouTube", url: "" }
    ]
  }
};

window.CURSOS = [
  {
    id: "curso-exemplo-1",
    categoria: "Categoria A",              // usada no filtro do catálogo (opcional)
    destaque: true,                        // true = aparece na página inicial                 // usado na URL: curso.html?id=curso-exemplo-1
    titulo: "Curso de Exemplo 1",
    resumo: "Resumo curto e objetivo do que o aluno vai aprender.",
    descricao: "Descrição completa do curso. Explique o resultado de aprendizagem, como funciona e o que está incluído.",
    imagem: null,                          // ex.: "assets/images/curso-1.webp"
    imagemAlt: "",
    publico: "Para quem está começando e quer uma base sólida.",
    preRequisitos: "Nenhum conhecimento prévio.",
    conteudo: ["Módulo 1 — Introdução", "Módulo 2 — Fundamentos", "Módulo 3 — Prática"],
    formato: "Online, no seu ritmo",
    cargaHoraria: null,                    // ex.: "20 horas"
    preco: null,                           // número (ex.: 197) ou null para ocultar
    checkoutUrl: "INSERIR_URL_OFICIAL_DO_CHECKOUT"   // precisa começar com https://
  },
  {
    id: "curso-exemplo-2",
    categoria: "Categoria B",
    destaque: true,
    titulo: "Curso de Exemplo 2",
    resumo: "Outro resumo curto, focado no principal benefício do curso.",
    descricao: "Descrição completa do segundo curso.",
    imagem: null, imagemAlt: "",
    publico: "Para quem já tem experiência e quer se aprofundar.",
    preRequisitos: "",
    conteudo: ["Módulo 1", "Módulo 2", "Módulo 3", "Módulo 4"],
    formato: "", cargaHoraria: null, preco: null,
    checkoutUrl: "INSERIR_URL_OFICIAL_DO_CHECKOUT"
  },
  {
    id: "curso-exemplo-3",
    categoria: "Categoria A",
    destaque: false,
    titulo: "Curso de Exemplo 3",
    resumo: "Mais um resumo de exemplo para ilustrar o catálogo.",
    descricao: "Descrição completa do terceiro curso.",
    imagem: null, imagemAlt: "",
    publico: "Para quem busca aplicar o conteúdo no dia a dia.",
    preRequisitos: "",
    conteudo: ["Módulo 1", "Módulo 2"],
    formato: "", cargaHoraria: null, preco: null,
    checkoutUrl: "INSERIR_URL_OFICIAL_DO_CHECKOUT"
  }
];
