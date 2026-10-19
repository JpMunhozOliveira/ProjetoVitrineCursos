// Ícones dos tipos de bloco (só do editor; a página pública não usa estes ícones).
// Tipos sem ícone próprio caem num ícone genérico — um bloco novo no servidor funciona mesmo assim.
const PATHS = {
  hero: "M3 4h18v10H3zM7 18h10M9 21h6",                                  // tela com destaque
  benefits: "M3 5h8v14H3zM13 5h8v14h-8zM6 9h2M16 9h2",                   // dois cartões
  topics: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",           // grade
  gallery: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01",            // imagem
  checklist: "M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M4 19h16",         // lista ✓
  comparison: "M3 4h7v16H3zM14 4h7v16h-7zM10.5 12h3",                    // duas colunas
  author: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6", // pessoa
  audience: "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 7-5s7 2 7 5M17 4a3 3 0 0 1 0 6M19 15c2 .7 3 2.3 3 5", // pessoas
  highlight: "M3 11v2l13 5V6zM16 9a3 3 0 0 1 0 6M6 13l1 6h3l-1-5",       // megafone
  cta: "M3 8h18v8H3zM13 12h5M16 10l2 2-2 2",                            // faixa com seta
  testimonials:"M4 5h16v11H10l-5 4v-4H4zM8 9h8M8 12h5",               // balão de fala
  faq: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01", // interrogação
  guarantee: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5", // escudo ✓
  offer: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",                              // etiqueta de preço
};
const FALLBACK = "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5";

export function BlockIcon({ type, className = "block-icon" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[type] || FALLBACK} fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
