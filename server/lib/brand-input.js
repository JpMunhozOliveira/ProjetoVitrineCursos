// Validação do corpo das requisições de empresas (separada do controller, sem banco, para os testes).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME = 80;

// Corpo de criação ou alteração: { name, logo_id, icon_id }. icon_id é opcional (ícone da aba). Devolve { value } ou { error }.
function normalizeBrandBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Envie um objeto JSON." };
  const unknown = Object.keys(body).filter((k) => !["name", "logo_id", "icon_id"].includes(k));
  if (unknown.length) return { error: `Campo(s) não suportado(s): ${unknown.join(", ")}.` };

  if (body.name !== undefined && body.name !== null && typeof body.name !== "string") {
    return { error: "O nome deve ser texto." };
  }
  const name = body.name?.trim() || null;
  if (name && name.length > MAX_NAME) return { error: `O nome deve ter no máximo ${MAX_NAME} caracteres.` };

  const logoId = body.logo_id ?? null;
  if (logoId !== null && !UUID.test(logoId)) return { error: "logo_id inválido." };
  if (!name && !logoId) return { error: "Informe o nome da empresa, o logo ou os dois." };
  const iconId = body.icon_id ?? null;
  if (iconId !== null && !UUID.test(iconId)) return { error: "icon_id inválido." };
  return { value: { name, logoId, iconId } };
}

module.exports = { UUID, MAX_NAME, normalizeBrandBody };
