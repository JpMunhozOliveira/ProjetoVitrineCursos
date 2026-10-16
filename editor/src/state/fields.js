// Campos marcados na pré-visualização: data-field="items.0.question" (caminho DENTRO do bloco,
// gerado pelo servidor em sales/render.js) -> definição do campo no esquema e caminho no estado.

// Devolve { field, path } ou null. path é o caminho completo para o dispatch:
// ["sections", 3, "items", 0, "question"].
export function resolveField(schema, sections, blockIndex, fieldPath) {
  const block = sections[blockIndex];
  if (!block || typeof fieldPath !== "string") return null;
  let fields = schema.blocks[block.type]?.fields, field = null;
  const parts = fieldPath.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  for (const part of parts) {
    if (typeof part === "number") continue;
    if (!fields || !Object.hasOwn(fields, part)) return null;
    field = fields[part];
    fields = field.item;
  }
  if (!field || !["text", "textarea"].includes(field.type)) return null;
  return { field, path: ["sections", blockIndex, ...parts] };
}

// Texto lido de um elemento editável -> valor do campo.
// Uma linha: quebras viram espaço. Várias linhas: no máximo uma linha em branco entre parágrafos
// (é o que separa os <p> na página). Espaço não separável (o navegador insere ao digitar) vira espaço.
export function normalizeText(raw, multiline) {
  let text = String(raw).replace(/\r\n?/g, "\n").replace(/ /g, " ");
  if (!text.trim()) return ""; // campo apagado (o navegador às vezes deixa um <br> sobrando)
  if (!multiline) return text.replace(/\n+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.replace(/\n$/, "");
}
