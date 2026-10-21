// Estado do editor: a página como um objeto { sections, theme }.
//
// Toda alteração gera um objeto NOVO (imutabilidade) em vez de modificar o atual. É assim que o
// React percebe o que mudou, e é o que permite desfazer/refazer (guardar versões anteriores).

let counter = 0;
const newKey = () => `k${++counter}`;

// O React precisa de uma "chave" estável para cada bloco e item de lista (para saber quem é
// quem ao reordenar). A chave (_key) só existe no editor: é removida antes de enviar à API.
export function withKeys(sections, schema) {
  const keyed = (obj, fields) => {
    const out = { ...obj, _key: obj._key || newKey() };
    for (const [name, field] of Object.entries(fields || {})) {
      if (field.type === "list") out[name] = (obj[name] || []).map((item) => keyed(item, field.item));
    }
    return out;
  };
  // Bloco vinculado a um bloco salvo só tem a referência e os campos locais (sem listas): não
  // ganha listas vazias, que seriam recusadas pela API como campos a mais.
  return sections.map((block) => keyed(block, block.shared ? null : schema.blocks[block.type]?.fields));
}

export function stripKeys(value) {
  if (Array.isArray(value)) return value.map(stripKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) if (k !== "_key") out[k] = stripKeys(v);
    return out;
  }
  return value;
}

// Reaproveita as chaves antigas (por posição) em dados que voltaram do servidor, para os
// blocos abertos continuarem abertos depois de salvar.
export function carryKeys(fresh, old) {
  if (Array.isArray(fresh)) return fresh.map((v, i) => carryKeys(v, old?.[i]));
  if (fresh && typeof fresh === "object") {
    const out = {};
    for (const [k, v] of Object.entries(fresh)) out[k] = carryKeys(v, old?.[k]);
    if (old?._key) out._key = old._key;
    return out;
  }
  return fresh;
}

// Valor vazio de um conjunto de campos (conforme o esquema do servidor).
export function emptyValue(fields) {
  const out = { _key: newKey() };
  for (const [name, field] of Object.entries(fields)) {
    out[name] = field.type === "list" ? [] : field.type === "bool" ? false
      : field.type === "image" ? null : field.type === "icon" ? "check"
      : field.type === "choice" ? field.default : "";
  }
  return out;
}

// O item tem algum texto digitado? Só contam os campos de texto (o ícone padrão de um item novo,
// por exemplo, não é algo que a pessoa escreveu).
export function hasText(item, fields) {
  return Object.entries(fields).some(([k, f]) => (f.type === "text" || f.type === "textarea") && item[k]?.trim());
}

// Listas começam com um item vazio, exceto as que exigem imagem (o item vazio seria inválido).
export function newBlock(type, schema) {
  const fields = schema.blocks[type].fields;
  const block = { type, ...emptyValue(fields) };
  for (const [name, field] of Object.entries(fields)) {
    const needsImage = Object.values(field.item || {}).some((f) => f.required);
    if (field.type === "list" && !needsImage) block[name] = [emptyValue(field.item)];
  }
  return block;
}

// Cópia de um bloco: objetos novos e chaves novas em todos os níveis (blocos e itens de lista),
// então editar a cópia nunca altera o original.
export function duplicateBlock(block, schema) {
  return withKeys([stripKeys(block)], schema)[0];
}

/* ---------- Alterações por "caminho" (ex.: ["sections", 2, "items", 0, "question"]) ---------- */
export function getIn(obj, path) {
  return path.reduce((value, key) => (value == null ? value : value[key]), obj);
}

export function setIn(obj, path, value) {
  if (!path.length) return value;
  const [head, ...rest] = path;
  const copy = Array.isArray(obj) ? obj.slice() : { ...obj };
  copy[head] = setIn(obj[head], rest, value);
  return copy;
}

const updateIn = (obj, path, fn) => setIn(obj, path, fn(getIn(obj, path)));

// Reducer: recebe o estado atual e uma ação, devolve o estado novo.
export function reducer(doc, action) {
  switch (action.type) {
    case "set":
      return setIn(doc, action.path, action.value);
    case "insert":
      return updateIn(doc, action.path, (list) => {
        const copy = list.slice();
        copy.splice(action.index ?? copy.length, 0, action.value);
        return copy;
      });
    case "remove":
      return updateIn(doc, action.path, (list) => list.filter((_, i) => i !== action.index));
    case "move":
      return updateIn(doc, action.path, (list) => {
        const copy = list.slice();
        const [item] = copy.splice(action.from, 1);
        copy.splice(action.to, 0, item);
        return copy;
      });
    default:
      throw new Error(`Ação desconhecida: ${action.type}`);
  }
}
