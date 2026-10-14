// Templates HTML sem dependências, com escape automático.
//
//   html`<h1>${titulo}</h1>`   -> o valor de "titulo" é escapado (< vira &lt; etc.)
//
// Só o que já é SafeHtml (resultado de outro html`...`) entra sem escape. Assim, um texto
// digitado no painel como "<script>" aparece na página como texto, nunca executa (XSS).
class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ENTITIES[c]);

function render(value) {
  if (value === null || value === undefined || value === false) return ""; // facilita ${cond && html`...`}
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escape(value);
}

function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => { out += render(value) + strings[i + 1]; });
  return new SafeHtml(out);
}

module.exports = { html, escape };
