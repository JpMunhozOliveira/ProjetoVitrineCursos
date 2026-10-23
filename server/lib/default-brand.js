// Empresa padrão (aba Empresas > "Empresa padrão do site"): logo no menu e ícone na aba do navegador
// das páginas do site (Início, Catálogo, Sobre...). As páginas são arquivos estáticos; o servidor
// acrescenta os dados da empresa no HTML antes de entregar (injectSiteBrand, em site-brand.js), no mesmo formato
// data-brand-* que as páginas de vendas usam e que public/js/components.js lê.
const pool = require("../config/database");
const storage = require("./storage");

const TTL_MS = 5 * 60 * 1000; // garantia para mudanças que não passam pela aba Empresas
let cached = null; // { brand, at }

async function get() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.brand;
  const { rows } = await pool.query(
    `SELECT b.name, m.storage_key AS logo_key, m.width AS logo_w, m.height AS logo_h, m.alt_text AS logo_alt,
            ic.storage_key AS icon_key
       FROM brands b LEFT JOIN media m ON m.id = b.logo_id LEFT JOIN media ic ON ic.id = b.icon_id
      WHERE b.is_default`);
  const r = rows[0];
  const brand = r ? {
    name: r.name,
    logo: r.logo_key ? { url: storage.publicUrl(r.logo_key), width: r.logo_w, height: r.logo_h, alt: r.logo_alt } : null,
    icon: r.icon_key ? { url: storage.publicUrl(r.icon_key) } : null,
  } : null;
  cached = { brand, at: Date.now() };
  return brand;
}

// Chamado ao salvar ou excluir uma empresa (e ao mudar o texto alternativo de uma imagem).
function invalidate() { cached = null; }

module.exports = { get, invalidate };
