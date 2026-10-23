// Áreas de conhecimento dos produtos: lista própria do site (a Kiwify não usa este campo). O painel
// mostra um seletor com esta lista (GET /api/admin/products/areas); a página inicial e o catálogo
// usam as áreas dos produtos publicados. Para mudar a lista, edite só aqui.
const AREAS = [
  "Imposto de Renda", "Simples Nacional", "Reforma Tributária", "Contabilidade", "Departamento Pessoal",
];

// Valor recebido -> { value } (uma das áreas ou null = sem área) ou { error }.
function normalizeArea(value) {
  if (value === null || value === undefined || value === "") return { value: null };
  if (typeof value !== "string" || !AREAS.includes(value.trim())) {
    return { error: "Área de conhecimento inválida. Escolha uma da lista." };
  }
  return { value: value.trim() };
}

module.exports = { AREAS, normalizeArea };
