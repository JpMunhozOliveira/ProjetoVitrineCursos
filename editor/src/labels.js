// Textos curtos reutilizados em mais de um componente.
export const PRODUCT_STATUS = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };

// "Tamanho recomendado: 1200 × 900 px (PNG com fundo transparente fica melhor)." (esquema: size e tip).
export const sizeHint = (field) => (field?.size ? `Tamanho recomendado: ${field.size}${field.tip ? ` (${field.tip})` : ""}.` : "");
