// "i" de informação: a explicação aparece num balão ao passar o mouse, focar com o teclado ou
// tocar (celular). Mesmas peças do resto do painel (.info-pop em admin.css); abrir pelo toque e
// fechar com Esc ou tocando fora ficam com o common.js. id: para o campo apontar a explicação
// com aria-describedby (leitores de tela leem o texto mesmo com o balão fechado).
import { useId } from "react";

export function InfoTip({ text, about, id }) {
  const own = useId();
  if (!text) return null;
  const tipId = id || `${own}-tip`;
  return (
    <span className="info-pop info-sm">
      <button type="button" className="info-btn" aria-label={`Sobre: ${about}`} aria-describedby={tipId} aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
      </button>
      <span id={tipId} className="info-text" role="tooltip">{text}</span>
    </span>
  );
}
