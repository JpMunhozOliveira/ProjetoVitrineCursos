// Esquema dos blocos da página de vendas: fonte única para validar o que chega na API,
// gerar o formulário do editor no painel e montar o modelo padrão de uma página nova.
//
// Tipos de campo:
//   text / textarea  -> texto (com tamanho máximo)
//   icon             -> um dos ícones de ICONS
//   image            -> ID de uma imagem da biblioteca (ou null)
//   bool             -> true/false
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
};

const text = (label, max, extra = {}) => ({ type: "text", label, max, ...extra });
const textarea = (label, max, extra = {}) => ({ type: "textarea", label, max, ...extra });
const icon = (label = "Ícone") => ({ type: "icon", label });
const image = (label, extra = {}) => ({ type: "image", label, ...extra });
const bool = (label) => ({ type: "bool", label });
const list = (label, max, item) => ({ type: "list", label, max, item });

const BLOCKS = {
  hero: {
    label: "Abertura",
    help: "Primeira dobra da página: título, chamada, selos, preço e botão de compra. Preço e link de checkout vêm do cadastro do produto.",
    fields: {
      logo: image("Logotipo (opcional)"),
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
    },
  },
  topics: {
    label: "Grade de tópicos",
    help: "O que a pessoa vai encontrar no produto (módulos, capítulos, temas).",
    fields: {
      title: text("Título da seção", 120),
      items: list("Tópicos", 12, { icon: icon(), title: text("Título", 80), text: textarea("Texto", 300) }),
    },
  },
  gallery: {
    label: "Galeria (carrossel)",
    help: "Imagens do produto por dentro. Sem imagens, o bloco não aparece na página.",
    fields: {
      title: text("Título da seção", 120),
      images: list("Imagens", 12, { image: image("Imagem", { required: true }) }),
    },
  },
  checklist: {
    label: "Lista ✓ / ✗",
    help: "O que o produto é e o que não é.",
    fields: {
      icon: icon(),
      title: text("Título", 120),
      items: list("Itens", 10, { text: text("Texto", 160), positive: bool("Positivo (✓)") }),
    },
  },
  comparison: {
    label: "Comparativo",
    help: "Dois lados: a alternativa comum (✗) e o seu produto (✓).",
    fields: {
      title: text("Título da seção", 120),
      left_title: text("Título do lado ✗", 80),
      left_items: list("Itens do lado ✗", 8, { text: text("Texto", 160) }),
      right_title: text("Título do lado ✓", 80),
      right_items: list("Itens do lado ✓", 8, { text: text("Texto", 160) }),
    },
  },
  author: {
    label: "Autor",
    help: "Quem criou o produto.",
    fields: {
      photo: image("Foto"),
      name: text("Nome", 120),
      role: text("Especialidade / cargo", 160),
      bio: textarea("Biografia", 1500),
    },
  },
  audience: {
    label: "Público-alvo",
    help: "Para quem é o produto.",
    fields: {
      title: text("Título da seção", 120),
      items: list("Perfis", 8, { icon: icon(), text: text("Texto", 60) }),
    },
  },
  highlight: {
    label: "Destaque",
    help: "Faixa escura com chamada e lista (ex.: bônus, conteúdo extra).",
    fields: {
      title: text("Título", 120),
      text: textarea("Texto", 600),
      items: list("Itens", 8, { text: text("Texto", 160) }),
    },
  },
  testimonials: {
    label: "Depoimentos",
    help: "O que clientes dizem do produto. Use só depoimentos reais. Depoimentos sem texto não aparecem.",
    fields: {
      title: text("Título da seção", 120),
      items: list("Depoimentos", 9, {
        quote: textarea("Depoimento", 600),
        name: text("Nome", 80),
        role: text("Profissão / cidade (opcional)", 80),
        photo: image("Foto (opcional)"),
      }),
    },
  },
  faq: {
    label: "Perguntas frequentes",
    help: "Funciona sem JavaScript (cada pergunta abre e fecha).",
    fields: {
      title: text("Título da seção", 120),
      items: list("Perguntas", 20, { question: text("Pergunta", 200), answer: textarea("Resposta", 1500) }),
    },
  },
  guarantee: {
    label: "Garantia",
    help: "Selos de compra segura.",
    fields: {
      title: text("Título", 120),
      items: list("Selos", 4, { icon: icon(), text: text("Texto", 80) }),
    },
  },
  offer: {
    label: "Oferta final",
    help: "Última chamada com preço e botão. Preço e link vêm do cadastro do produto.",
    fields: {
      image: image("Imagem"),
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
    { type: "hero", lead: "Uma frase que resume a transformação que o produto entrega.",
      badges: [{ strong: "PDF", text: "Prático" }, { strong: "Acesso", text: "Imediato" }],
      price_label: "Por apenas", cta_label: "Comprar agora" },
    { type: "benefits", title: "Benefícios", items: [
      { icon: "bolt", title: "Primeiro benefício", text: "Explique o benefício em uma ou duas frases.", callout: "" },
      { icon: "doc", title: "Segundo benefício", text: "Explique o benefício em uma ou duas frases.", callout: "" }] },
    { type: "topics", title: "O que você vai encontrar", items: [
      { icon: "doc", title: "Tópico 1", text: "Resumo do tópico." },
      { icon: "check", title: "Tópico 2", text: "Resumo do tópico." }] },
    { type: "gallery", title: "Conheça por dentro", images: [] },
    { type: "checklist", icon: "shield", title: "Conteúdo focado no que importa", items: [
      { text: "O que o produto não é", positive: false }, { text: "O que o produto entrega", positive: true }] },
    { type: "comparison", title: "Diferenciais", left_title: "Alternativa comum",
      left_items: [{ text: "Ponto fraco da alternativa" }], right_title: "Este produto",
      right_items: [{ text: "Ponto forte do produto" }] },
    { type: "author", name: "Nome do autor", role: "Especialidade", bio: "Breve biografia." },
    { type: "audience", title: "Para quem é este material?", items: [{ icon: "user", text: "Perfil 1" }] },
    { type: "faq", title: "Dúvidas mais frequentes", items: [
      { question: "Em que formato recebo o produto?", answer: "Explique o formato e como acessar." },
      { question: "Tem garantia?", answer: "Explique a política de garantia." }] },
    { type: "guarantee", title: "Compra segura e garantida", items: [
      { icon: "shield", text: "Pagamento 100% seguro" }, { icon: "check", text: "7 dias de garantia" },
      { icon: "bolt", text: "Acesso imediato" }] },
    { type: "offer", title: "Garanta agora o seu acesso", price_label: "Oferta especial", cta_label: "Garantir agora" },
  ].map((block) => validateSections([block]).sections[0]); // preenche os campos que faltam
}

module.exports = { ICONS, BLOCKS, MAX_BLOCKS, validateSections, mediaIds, defaultSections };
