// Texto formatado dos blocos: negrito, itálico, cor e alinhamento, guardados como marcações curtas
// dentro do próprio texto (textos antigos, sem marcações, continuam valendo):
//
//   [align=center]Texto com [b]negrito[/b], [i]itálico[/i] e [c=accent]cor[/c]
//
//   [align=…]  prefixo opcional: left | center | right | justify (sem prefixo = padrão do bloco)
//   [b] [i]    negrito e itálico
//   [c=…]      cor da paleta (COLORS): acompanha o tema e o fundo da seção (ver venda.css)
//   [[         um "[" literal (o editor escapa o que a pessoa digita)
//
// NUNCA entra HTML: o texto é escapado e só estas marcações viram tags (<strong>, <em>,
// <span class="tx-c-…">). Marcação desconhecida ou mal formada aparece como texto.
const { html, escape } = require("../lib/html");

const COLORS = { accent: "Destaque", primary: "Cor principal", muted: "Cinza", green: "Verde", red: "Vermelho" };
const ALIGNS = { left: "Esquerda", center: "Centro", right: "Direita", justify: "Justificado" };

const ALIGN_PREFIX = /^\[align=(left|center|right|justify)\]/;
const TOKEN = /\[\[|\[(\/?)(b|i|c)(?:=([a-z]+))?\]/g;
const PARAGRAPH_BREAK = /\n[ \t]*\n\s*/;

// { align, body }: separa o prefixo de alinhamento do resto.
function split(value) {
  const text = typeof value === "string" ? value : "";
  const m = ALIGN_PREFIX.exec(text);
  return { align: m ? m[1] : null, body: m ? text.slice(m[0].length) : text };
}

// Texto -> trechos [{ text, marks }], onde marks é a lista de formatações ativas naquele trecho
// (ex.: [{ tag: "b" }, { tag: "c", color: "accent" }]). Fechamento sem abertura vira texto;
// abertura sem fechamento vale até o fim.
function runs(body) {
  const out = [], stack = [];
  const push = (text) => { if (text) out.push({ text, marks: stack.slice() }); };
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    push(body.slice(last, m.index));
    last = m.index + m[0].length;
    const [token, close, tag, color] = m;
    if (token === "[[") { push("["); continue; }
    if (close) {
      const at = color ? -1 : stack.findLastIndex((x) => x.tag === tag);
      if (at < 0) push(token); else stack.splice(at, 1);
    } else if ((tag === "c") !== !!color || (color && !Object.hasOwn(COLORS, color))) {
      push(token); // [b=x], [c] sem cor, cor desconhecida: texto
    } else {
      stack.push(tag === "c" ? { tag, color } : { tag });
    }
  }
  push(body.slice(last));
  return out;
}

const same = (a, b) => a.tag === b.tag && a.color === b.color;

// Monta a saída abrindo e fechando as formatações entre um trecho e o seguinte.
function build(list, { open, close, text }) {
  let out = "", current = [];
  for (const run of list) {
    let k = 0;
    while (k < current.length && k < run.marks.length && same(current[k], run.marks[k])) k++;
    for (let j = current.length - 1; j >= k; j--) out += close(current[j]);
    for (let j = k; j < run.marks.length; j++) out += open(run.marks[j]);
    out += text(run.text);
    current = run.marks;
  }
  for (let j = current.length - 1; j >= 0; j--) out += close(current[j]);
  return out;
}

const HTML_TAGS = {
  open: (m) => (m.tag === "b" ? "<strong>" : m.tag === "i" ? "<em>" : `<span class="tx-c-${m.color}">`),
  close: (m) => (m.tag === "b" ? "</strong>" : m.tag === "i" ? "</em>" : "</span>"),
  text: escape,
};
const MARKUP = {
  open: (m) => (m.tag === "c" ? `[c=${m.color}]` : `[${m.tag}]`),
  close: (m) => `[/${m.tag}]`,
  text: (t) => t.replace(/\[/g, "[["),
};

// Divide os trechos nos parágrafos (linha em branco), mantendo a formatação de cada pedaço.
function paragraphRuns(list) {
  const paras = [[]];
  for (const run of list) {
    run.text.split(PARAGRAPH_BREAK).forEach((text, i) => {
      if (i > 0) paras.push([]);
      if (text) paras[paras.length - 1].push({ text, marks: run.marks });
    });
  }
  return paras.filter((p) => p.some((r) => r.text.trim()));
}

// HTML (já seguro) do conteúdo do texto, sem o alinhamento.
const toHtml = (value) => html([build(runs(split(value).body), HTML_TAGS)]);

// HTML de cada parágrafo (textos longos): [SafeHtml, ...].
const paragraphsHtml = (value) => paragraphRuns(runs(split(value).body)).map((p) => html([build(p, HTML_TAGS)]));

// Texto visível, sem marcações (limites de tamanho, leitores de tela, painel do editor).
const plain = (value) => runs(split(value).body).map((r) => r.text).join("");

const alignOf = (value) => split(value).align;

// Forma limpa para gravar: marcações inválidas viram texto escapado, formatações vazias somem.
function canonical(value) {
  const { align, body } = split(value);
  const list = runs(body);
  if (!list.some((r) => r.text.trim())) return "";
  return (align ? `[align=${align}]` : "") + build(list, MARKUP);
}

module.exports = { COLORS, ALIGNS, toHtml, paragraphsHtml, plain, alignOf, canonical };
