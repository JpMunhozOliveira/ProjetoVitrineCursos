// Categorias dos produtos: lista fixa (o painel mostra um seletor; o catálogo filtra por elas).
// Para criar uma categoria nova, acrescente aqui e em public/admin/produto.html (<select id="category">).
const CATEGORIES = ["Curso", "Guia", "Manual"];

// Valor recebido -> { value } (uma das categorias ou null = sem categoria) ou { error }.
function normalizeCategory(value) {
  if (value === null || value === undefined || value === "") return { value: null };
  if (typeof value !== "string" || !CATEGORIES.includes(value.trim())) {
    return { error: `Categoria inválida. Use uma destas: ${CATEGORIES.join(", ")}.` };
  }
  return { value: value.trim() };
}

module.exports = { CATEGORIES, normalizeCategory };
