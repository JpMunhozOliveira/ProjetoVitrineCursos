// Texto formatado no editor: converte o conteúdo editável da página (DOM) nas marcações que o
// servidor entende (ver server/sales/richtext.js) e o caminho inverso para o painel lateral.
//
//   [align=center]Texto com [b]negrito[/b], [i]itálico[/i] e [c=accent]cor[/c]   ("[[" = "[")
//
// As funções só usam nodeType, nodeName, childNodes, data e getAttribute: dá para testar sem
// navegador (editor/test/richtext.test.js).

export const COLOR_KEYS = ["accent", "primary", "muted", "green", "red"];
export const ALIGN_KEYS = ["left", "center", "right", "justify"];

// Cor-sentinela de cada cor da paleta: a barra aplica a cor com execCommand("foreColor") usando
// estes valores (o navegador divide e junta os trechos sozinho) e depois troca <font color> por
// <span class="tx-c-…">, como o servidor desenha.
export const SENTINELS = { accent: "#010101", primary: "#020202", muted: "#030303", green: "#040404", red: "#050505" };
const SENTINEL_COLOR = Object.fromEntries(Object.entries(SENTINELS).map(([k, v]) => [v, k]));

const ALIGN_PREFIX = /^\[align=(left|center|right|justify)\]/;
const TOKEN = /\[\[|\[(\/?)(b|i|c)(?:=([a-z]+))?\]/g;

const same = (a, b) => a.tag === b.tag && a.color === b.color;
const escapeText = (text) => text.replace(/\[/g, "[[");

// Trechos [{ text, marks }] -> marcações, abrindo e fechando entre um trecho e o seguinte.
// As quebras de linha ficam fora de qualquer formatação (ela não atravessa parágrafos).
function toMarkup(runs) {
  const pieces = [];
  for (const run of runs) {
    run.text.split("\n").forEach((text, i) => {
      if (i > 0) pieces.push({ text: "\n", marks: [] });
      if (text) pieces.push({ text, marks: run.marks });
    });
  }
  let out = "", current = [];
  const open = (m) => (m.tag === "c" ? `[c=${m.color}]` : `[${m.tag}]`);
  for (const piece of pieces) {
    let k = 0;
    while (k < current.length && k < piece.marks.length && same(current[k], piece.marks[k])) k++;
    for (let j = current.length - 1; j >= k; j--) out += `[/${current[j].tag}]`;
    for (let j = k; j < piece.marks.length; j++) out += open(piece.marks[j]);
    out += escapeText(piece.text);
    current = piece.marks;
  }
  for (let j = current.length - 1; j >= 0; j--) out += `[/${current[j].tag}]`;
  return out;
}

// Formatação que um elemento da página representa (ou null).
function markOf(el) {
  const name = el.nodeName.toUpperCase();
  if (name === "B" || name === "STRONG") return { tag: "b" };
  if (name === "I" || name === "EM") return { tag: "i" };
  // <span class="tx-c-accent"> (como o servidor desenha) ou <font color> da barra, antes da troca.
  const cls = /(?:^|\s)tx-c-([a-z]+)(?:\s|$)/.exec(el.getAttribute?.("class") || "");
  const color = cls?.[1] || SENTINEL_COLOR[(el.getAttribute?.("color") || "").toLowerCase()];
  if ((name === "SPAN" || name === "FONT") && COLOR_KEYS.includes(color)) return { tag: "c", color };
  return null;
}

// Conteúdo editável -> trechos. <p> separa parágrafos (linha em branco); <div> e <br>, linha.
function collect(root) {
  const runs = [];
  const newline = (n) => {
    const text = runs.map((r) => r.text).join("");
    if (!text) return;
    const trailing = text.length - text.replace(/\n+$/, "").length;
    if (trailing < n) runs.push({ text: "\n".repeat(n - trailing), marks: [] });
  };
  const walk = (node, marks) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) { runs.push({ text: child.data, marks }); continue; }
      if (child.nodeType !== 1) continue;
      const name = child.nodeName.toUpperCase();
      if (name === "BR") { runs.push({ text: "\n", marks: [] }); continue; }
      const block = name === "P" || name === "DIV";
      if (block) newline(name === "P" ? 2 : 1);
      const mark = markOf(child);
      walk(child, mark && !marks.some((m) => m.tag === mark.tag) ? [...marks.filter((m) => m.tag !== mark.tag), mark] : marks);
      if (block) newline(name === "P" ? 2 : 1);
    }
  };
  walk(root, []);
  return runs;
}

// Elemento editável -> valor do campo (com o alinhamento do atributo data-align).
// Uma linha: quebras viram espaço. Várias linhas: no máximo uma linha em branco entre parágrafos.
export function serialize(root, multiline) {
  const runs = collect(root).map((r) => ({ ...r, text: r.text.replace(/\r\n?/g, "\n").replace(/ /g, " ") }));
  if (!runs.some((r) => r.text.trim())) return "";
  const lines = multiline ? runs : runs.map((r) => ({ ...r, text: r.text.replace(/\n+/g, " ") }));
  let body = toMarkup(lines);
  if (multiline) body = body.replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
  const align = root.getAttribute?.("data-align");
  return (ALIGN_KEYS.includes(align) ? `[align=${align}]` : "") + body;
}

// Trechos de um valor guardado (mesma regra do servidor).
function runsOf(body) {
  const out = [], stack = [];
  let last = 0;
  const push = (text) => { if (text) out.push({ text, marks: stack.slice() }); };
  for (const m of body.matchAll(TOKEN)) {
    push(body.slice(last, m.index));
    last = m.index + m[0].length;
    const [token, close, tag, color] = m;
    if (token === "[[") { push("["); continue; }
    if (close) {
      const at = color ? -1 : stack.findLastIndex((x) => x.tag === tag);
      if (at < 0) push(token); else stack.splice(at, 1);
    } else if ((tag === "c") !== !!color || (color && !COLOR_KEYS.includes(color))) push(token);
    else stack.push(tag === "c" ? { tag, color } : { tag });
  }
  push(body.slice(last));
  return out;
}

const splitAlign = (value) => {
  const text = typeof value === "string" ? value : "";
  const m = ALIGN_PREFIX.exec(text);
  return { align: m ? m[1] : null, body: m ? text.slice(m[0].length) : text };
};

// Texto visível, sem marcações (painel lateral).
export const plain = (value) => runsOf(splitAlign(value).body).map((r) => r.text).join("");

// Tem negrito/itálico/cor? (o painel avisa que editar ali tira essa formatação)
export const hasInline = (value) => runsOf(splitAlign(value).body).some((r) => r.marks.length);

// Texto digitado no painel -> valor: mantém o alinhamento, troca o conteúdo por texto puro.
export function fromPlain(previous, text) {
  const { align } = splitAlign(previous);
  return text.trim() ? (align ? `[align=${align}]` : "") + escapeText(text) : text;
}
