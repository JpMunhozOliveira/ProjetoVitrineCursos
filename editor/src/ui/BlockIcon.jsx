// Ícones dos tipos de bloco (só do painel; a página pública não usa estes ícones).
// Os desenhos ficam em public/admin/js/common.js (Admin.BLOCK_ICONS), que a página do editor já
// carrega antes deste código: assim a aba Blocos salvos e o editor usam os mesmos ícones.
// Tipos sem ícone próprio caem num ícone genérico — um bloco novo no servidor funciona mesmo assim.
const FALLBACK = "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5";

export function BlockIcon({ type, className = "block-icon" }) {
  const icons = (typeof window !== "undefined" && window.Admin && window.Admin.BLOCK_ICONS) || {};
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={icons[type] || icons._fallback || FALLBACK} fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
