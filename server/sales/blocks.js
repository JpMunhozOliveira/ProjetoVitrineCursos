// Esquema dos blocos da página de vendas: fonte única para validar o que chega na API,
// gerar o formulário do editor no painel e montar o modelo padrão de uma página nova.
//
// Tipos de campo:
//   text / textarea  -> texto (com tamanho máximo)
//   icon             -> um dos ícones de ICONS
//   image            -> ID de uma imagem da biblioteca (ou null)
//   bool             -> true/false
//   choice           -> uma das opções de "options" ({ valor: rótulo }); vazio = "default"
//   list             -> lista de itens; cada item tem seus próprios campos (item: {...})

// Ícones disponíveis nos blocos: nome, desenho (SVG 24×24) e espessura do traço. Fonte única:
// a página pública monta o sprite a partir daqui (render.js) e o editor mostra os mesmos desenhos.
const ICONS = {
  check: { label: "Confirmação", d: "M5 12.5l4.5 4.5L19 7.5", width: 2.6 },
  x: { label: "Negação", d: "M6 6l12 12M18 6L6 18", width: 2.6 },
  doc: { label: "Documento", d: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
  bolt: { label: "Raio", d: "M13 3L5 14h6l-1 7 8-11h-6z" },
  shield: { label: "Escudo", d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" },
  user: { label: "Pessoa", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6" },
  calc: { label: "Calculadora", d: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7h8M8 12h2M12 12h2M8 16h2M12 16h2" },
  // Estudo e conteúdo
  book: { label: "Livro", d: "M4 19V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14M8 7h8" },
  cap: { label: "Formatura", d: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6" },
  video: { label: "Vídeo", d: "M3 5h18v14H3zM10 9l5 3-5 3z" },
  layers: { label: "Módulos", d: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" },
  clipboard: { label: "Lista de tarefas", d: "M9 3h6v3H9zM7 4H5v17h14V4h-2M9 13l2 2 4-4" },
  folder: { label: "Pasta", d: "M3 6h6l2 2h10v11H3z" },
  pencil: { label: "Lápis", d: "M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3" },
  bulb: { label: "Ideia", d: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" },
  search: { label: "Lupa", d: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5" },
  download: { label: "Download", d: "M12 4v11M7 10l5 5 5-5M5 20h14" },
  laptop: { label: "Computador", d: "M5 5h14v10H5zM2 19h20" },
  mobile: { label: "Celular", d: "M8 3h8v18H8zM11 18h2" },
  // Tempo e progresso
  clock: { label: "Relógio", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" },
  calendar: { label: "Calendário", d: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4" },
  refresh: { label: "Atualização", d: "M20 11a8 8 0 0 0-14-5L4 8M4 3v5h5M4 13a8 8 0 0 0 14 5l2-2M20 21v-5h-5" },
  target: { label: "Alvo", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01" },
  trend: { label: "Crescimento", d: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  chart: { label: "Gráfico de barras", d: "M4 20h16M7 16v-5M12 16V7M17 16v-8" },
  pie: { label: "Gráfico de pizza", d: "M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.5 9H15z" },
  flag: { label: "Bandeira", d: "M5 21V4M5 4h12l-2 4 2 4H5" },
  // Contabilidade, tributos e dinheiro
  money: { label: "Dinheiro", d: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4" },
  card: { label: "Cartão", d: "M3 6h18v12H3zM3 10h18M7 15h4" },
  percent: { label: "Porcentagem", d: "M19 5L5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  receipt: { label: "Nota fiscal", d: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" },
  scale: { label: "Balança (legislação)", d: "M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" },
  building: { label: "Empresa", d: "M4 21V5l8-2v18M12 8h8v13M8 8v.01M8 12v.01M8 16v.01M16 12v.01M16 16v.01M2 21h20" },
  briefcase: { label: "Maleta", d: "M3 8h18v12H3zM8 8V5h8v3M3 13h18" },
  // Pessoas e contato
  users: { label: "Grupo", d: "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 7-5s7 2 7 5M17 4a3 3 0 0 1 0 6M19 15c2 .7 3 2.3 3 5" },
  chat: { label: "Conversa", d: "M4 5h16v11H10l-5 4v-4H4zM8 9h8M8 12h5" },
  mail: { label: "E-mail", d: "M3 5h18v14H3zM3 7l9 6 9-6" },
  phone: { label: "Telefone", d: "M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" },
  headset: { label: "Suporte", d: "M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v6H4zM17 14h3v6h-3zM20 20a2 2 0 0 1-2 2h-4" },
  globe: { label: "Internet", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" },
  pin: { label: "Local", d: "M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  // Confiança e destaque
  lock: { label: "Cadeado", d: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3M12 15v2" },
  star: { label: "Estrela", d: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z" },
  award: { label: "Medalha", d: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7" },
  heart: { label: "Coração", d: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" },
  thumb: { label: "Aprovado", d: "M7 10v11H3V10zM7 10l4-7c1.5 0 2.5 1 2 3l-1 4h6a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 16.7 21H7" },
  gift: { label: "Bônus", d: "M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7c-1.5-3-5-3.5-5-1.2C7 7 9 7 12 7zM12 7c1.5-3 5-3.5 5-1.2C17 7 15 7 12 7z" },
  eye: { label: "Visão", d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  info: { label: "Informação", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" },
  alert: { label: "Atenção", d: "M12 3l10 18H2zM12 10v4M12 17h.01" },
};

// Grupos do seletor de ícones do editor (cada ícone em exatamente um grupo).
const ICON_GROUPS = [
  ["Básicos", ["check", "x", "doc", "bolt", "shield", "user", "calc"]],
  ["Estudo e conteúdo", ["book", "cap", "video", "layers", "clipboard", "folder", "pencil", "bulb", "search", "download", "laptop", "mobile"]],
  ["Tempo e progresso", ["clock", "calendar", "refresh", "target", "trend", "chart", "pie", "flag"]],
  ["Contabilidade e dinheiro", ["money", "card", "percent", "receipt", "scale", "building", "briefcase"]],
  ["Pessoas e contato", ["users", "chat", "mail", "phone", "headset", "globe", "pin"]],
  ["Confiança e destaque", ["lock", "star", "award", "heart", "thumb", "gift", "eye", "info", "alert"]],
];

const text = (label, max, extra = {}) => ({ type: "text", label, max, ...extra });
const textarea = (label, max, extra = {}) => ({ type: "textarea", label, max, ...extra });
const icon = (label = "Ícone") => ({ type: "icon", label });
const image = (label, extra = {}) => ({ type: "image", label, ...extra });
const bool = (label) => ({ type: "bool", label });
const list = (label, max, item) => ({ type: "list", label, max, item });
const choice = (label, options, fallback, extra = {}) => ({ type: "choice", label, options, default: fallback, ...extra });

// Campos de aparência, comuns a vários blocos.
// Rótulo: texto curto em caixa alta acima do título (ex.: "CONTEÚDO DO CURSO").
const eyebrow = () => text("Rótulo acima do título", 40, { help: "Opcional. Texto curto que aparece em caixa alta acima do título." });
// Fundo da seção. "Automático": o padrão do bloco (claro e cinza se alternam; o Autor é escuro).
const background = () => choice("Fundo da seção", { auto: "Automático", light: "Claro", soft: "Cinza", dark: "Escuro" }, "auto");

const BLOCKS = {
  hero: {
    label: "Abertura",
    help: "Primeira dobra da página: título, chamada, selos, preço e botão de compra. Preço e link de checkout vêm do cadastro do produto.",
    fields: {
      logo: image("Logotipo (opcional)"),
      eyebrow: eyebrow(),
      title: text("Título", 200, { help: "Vazio = usa o título do produto." }),
      lead: textarea("Chamada", 600),
      badges: list("Selos", 6, { strong: text("Destaque", 30), text: text("Complemento", 40) }),
      price_label: text("Texto acima do preço", 40, { placeholder: "Por apenas" }),
      cta_label: text("Texto do botão", 60, { placeholder: "Comprar agora" }),
      image: image("Imagem (mockup do produto)"),
    },
  },
  benefits: {
    label: "Cartões de benefícios",
    help: "Dois a quatro cartões com os principais benefícios.",
    fields: {
      title: text("Título da seção (só para leitores de tela)", 120),
      items: list("Cartões", 4, {
        icon: icon(), title: text("Título", 80), text: textarea("Texto", 400), callout: text("Destaque", 200),
      }),
      background: background(),
    },
  },
  topics: {
    label: "Grade de tópicos",
    help: "O que a pessoa vai encontrar no produto (módulos, capítulos, temas). Com fundo escuro, vira um painel de conteúdo.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      items: list("Tópicos", 12, { icon: icon(), title: text("Título", 80), text: textarea("Texto", 300) }),
      background: background(),
    },
  },
  gallery: {
    label: "Galeria (carrossel)",
    help: "Imagens do produto por dentro. Sem imagens, o bloco não aparece na página.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      images: list("Imagens", 12, { image: image("Imagem", { required: true }) }),
      background: background(),
    },
  },
  checklist: {
    label: "Lista ✓ / ✗",
    help: "O que o produto é e o que não é.",
    fields: {
      icon: icon(),
      eyebrow: eyebrow(),
      title: text("Título", 120),
      items: list("Itens", 10, { text: text("Texto", 160), positive: bool("Positivo (✓)") }),
      background: background(),
    },
  },
  comparison: {
    label: "Comparativo",
    help: "Dois lados: a alternativa comum (✗) e o seu produto (✓).",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      left_title: text("Título do lado ✗", 80),
      left_items: list("Itens do lado ✗", 8, { text: text("Texto", 160) }),
      right_title: text("Título do lado ✓", 80),
      right_items: list("Itens do lado ✓", 8, { text: text("Texto", 160) }),
      background: background(),
    },
  },
  author: {
    label: "Autor",
    help: "Quem criou o produto.",
    fields: {
      photo: image("Foto"),
      eyebrow: eyebrow(),
      name: text("Nome", 120),
      role: text("Especialidade / cargo", 160),
      bio: textarea("Biografia", 1500),
      background: background(),
    },
  },
  audience: {
    label: "Público-alvo",
    help: "Para quem é o produto.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      items: list("Perfis", 8, { icon: icon(), text: text("Texto", 60) }),
      background: background(),
    },
  },
  highlight: {
    label: "Destaque",
    help: "Cartão escuro com chamada e lista (ex.: bônus, conteúdo extra).",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título", 120),
      text: textarea("Texto", 600),
      items: list("Itens", 8, { text: text("Texto", 160) }),
      background: background(),
    },
  },
  cta: {
    label: "Chamada intermediária",
    help: "Faixa escura e compacta com o botão de compra, para usar no meio da página. Preço e link vêm do cadastro do produto.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Texto", 160),
      cta_label: text("Texto do botão", 60, { placeholder: "Quero garantir" }),
    },
  },
  testimonials: {
    label: "Depoimentos",
    help: "O que clientes dizem do produto. Use só depoimentos reais. Depoimentos sem texto não aparecem.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      items: list("Depoimentos", 9, {
        quote: textarea("Depoimento", 600),
        name: text("Nome", 80),
        role: text("Profissão / cidade (opcional)", 80),
        photo: image("Foto (opcional)"),
      }),
      background: background(),
    },
  },
  faq: {
    label: "Perguntas frequentes",
    help: "Funciona sem JavaScript (cada pergunta abre e fecha).",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      items: list("Perguntas", 20, { question: text("Pergunta", 200), answer: textarea("Resposta", 1500) }),
      background: background(),
    },
  },
  guarantee: {
    label: "Garantia",
    help: "Faixa de confiança: selos de compra segura, suporte e condições.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título", 120),
      items: list("Selos", 4, { icon: icon(), text: text("Texto", 80) }),
      background: background(),
    },
  },
  offer: {
    label: "Oferta final",
    help: "Última chamada com preço e botão. Preço e link vêm do cadastro do produto.",
    fields: {
      image: image("Imagem"),
      eyebrow: eyebrow(),
      title: text("Título", 200),
      price_label: text("Texto acima do preço", 40, { placeholder: "Oferta especial" }),
      cta_label: text("Texto do botão", 60, { placeholder: "Garantir agora" }),
    },
  },
};

const MAX_BLOCKS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// Nome definido no próprio objeto (o operador "in" aceitaria também "constructor", "toString"...).
const has = (obj, key) => typeof key === "string" && Object.hasOwn(obj, key);

class ValidationError extends Error {}

// Valida e normaliza os campos de um objeto conforme "fields". "where" monta mensagens como
// "Bloco 3 (FAQ) › Perguntas › item 2 › Resposta".
function validateFields(input, fields, where) {
  if (!isObject(input)) throw new ValidationError(`${where}: formato inválido.`);
  const unknown = Object.keys(input).filter((k) => !has(fields, k));
  if (unknown.length) throw new ValidationError(`${where}: campo(s) não suportado(s): ${unknown.join(", ")}.`);

  const out = {};
  for (const [name, field] of Object.entries(fields)) {
    const value = input[name];
    const at = `${where} › ${field.label}`;
    switch (field.type) {
      case "text":
      case "textarea": {
        if (value !== undefined && value !== null && typeof value !== "string") throw new ValidationError(`${at}: deve ser texto.`);
        const v = (value || "").trim();
        if (v.length > field.max) throw new ValidationError(`${at}: máximo de ${field.max} caracteres.`);
        out[name] = v;
        break;
      }
      case "icon":
        if (value !== undefined && value !== null && value !== "" && !has(ICONS, value)) throw new ValidationError(`${at}: ícone inválido.`);
        out[name] = value || "check";
        break;
      case "image":
        if (value !== undefined && value !== null && value !== "" && !(typeof value === "string" && UUID.test(value))) {
          throw new ValidationError(`${at}: imagem inválida.`);
        }
        if (field.required && !value) throw new ValidationError(`${at}: escolha uma imagem.`);
        out[name] = value || null;
        break;
      case "bool":
        if (value !== undefined && typeof value !== "boolean") throw new ValidationError(`${at}: deve ser verdadeiro ou falso.`);
        out[name] = !!value;
        break;
      case "choice":
        if (value !== undefined && value !== null && value !== "" && !has(field.options, value)) throw new ValidationError(`${at}: opção inválida.`);
        out[name] = value || field.default;
        break;
      case "list": {
        if (value !== undefined && !Array.isArray(value)) throw new ValidationError(`${at}: deve ser uma lista.`);
        const items = value || [];
        if (items.length > field.max) throw new ValidationError(`${at}: máximo de ${field.max} itens.`);
        out[name] = items.map((item, i) => validateFields(item, field.item, `${at} › item ${i + 1}`));
        break;
      }
      default:
        throw new Error(`Tipo de campo desconhecido: ${field.type}`);
    }
  }
  return out;
}

// Valida a lista de blocos inteira. Devolve { sections } normalizado ou { error }.
function validateSections(sections) {
  try {
    if (!Array.isArray(sections)) throw new ValidationError("sections deve ser uma lista de blocos.");
    if (sections.length > MAX_BLOCKS) throw new ValidationError(`Use no máximo ${MAX_BLOCKS} blocos.`);
    const out = sections.map((block, i) => {
      if (!isObject(block) || !has(BLOCKS, block.type)) throw new ValidationError(`Bloco ${i + 1}: tipo inválido.`);
      const { type, ...fields } = block;
      return { type, ...validateFields(fields, BLOCKS[type].fields, `Bloco ${i + 1} (${BLOCKS[type].label})`) };
    });
    return { sections: out };
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

// IDs de todas as imagens usadas nos blocos (para buscar URLs e registrar o uso).
function mediaIds(sections) {
  const ids = new Set();
  const walk = (value, fields) => {
    for (const [name, field] of Object.entries(fields)) {
      if (field.type === "image" && value[name]) ids.add(value[name]);
      if (field.type === "list") (value[name] || []).forEach((item) => walk(item, field.item));
    }
  };
  sections.forEach((block) => BLOCKS[block.type] && walk(block, BLOCKS[block.type].fields));
  return [...ids];
}

// Modelo padrão de uma página nova: a estrutura do Manual, com textos de orientação.
function defaultSections() {
  return [
    { type: "hero", eyebrow: "Material profissional", lead: "Uma frase que resume a transformação que o produto entrega.",
      badges: [{ strong: "PDF", text: "Prático" }, { strong: "Acesso", text: "Imediato" }],
      price_label: "Por apenas", cta_label: "Comprar agora" },
    { type: "benefits", title: "Benefícios", items: [
      { icon: "bolt", title: "Primeiro benefício", text: "Explique o benefício em uma ou duas frases.", callout: "" },
      { icon: "doc", title: "Segundo benefício", text: "Explique o benefício em uma ou duas frases.", callout: "" }] },
    { type: "topics", eyebrow: "Conteúdo", title: "O que você vai encontrar", items: [
      { icon: "doc", title: "Tópico 1", text: "Resumo do tópico." },
      { icon: "check", title: "Tópico 2", text: "Resumo do tópico." }] },
    { type: "gallery", eyebrow: "Por dentro", title: "Conheça por dentro", images: [] },
    { type: "cta", title: "Pronto para começar? O acesso é imediato.", cta_label: "Quero garantir" },
    { type: "checklist", icon: "shield", title: "Conteúdo focado no que importa", items: [
      { text: "O que o produto não é", positive: false }, { text: "O que o produto entrega", positive: true }] },
    { type: "comparison", eyebrow: "Diferenciais", title: "Por que este material", left_title: "Alternativa comum",
      left_items: [{ text: "Ponto fraco da alternativa" }], right_title: "Este produto",
      right_items: [{ text: "Ponto forte do produto" }] },
    { type: "author", eyebrow: "Quem ensina", name: "Nome do autor", role: "Especialidade", bio: "Breve biografia." },
    { type: "audience", title: "Para quem é este material?", items: [{ icon: "user", text: "Perfil 1" }] },
    { type: "faq", eyebrow: "Dúvidas", title: "Dúvidas mais frequentes", items: [
      { question: "Em que formato recebo o produto?", answer: "Explique o formato e como acessar." },
      { question: "Tem garantia?", answer: "Explique a política de garantia." }] },
    { type: "guarantee", title: "Compra segura e garantida", items: [
      { icon: "shield", text: "Pagamento 100% seguro" }, { icon: "check", text: "7 dias de garantia" },
      { icon: "bolt", text: "Acesso imediato" }] },
    { type: "offer", eyebrow: "Oferta", title: "Garanta agora o seu acesso", price_label: "Oferta especial", cta_label: "Garantir agora" },
  ].map((block) => validateSections([block]).sections[0]); // preenche os campos que faltam
}

module.exports = { ICONS, ICON_GROUPS, BLOCKS, MAX_BLOCKS, validateSections, mediaIds, defaultSections };
