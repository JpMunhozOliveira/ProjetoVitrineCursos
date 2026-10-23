// Escolha do tipo de bloco. Usa o <dialog> nativo: foco preso no diálogo, Esc fecha e o fundo fica
// bloqueado (nada é inserido sem escolher). Duas formas:
//   anchor (retângulo do "+" clicado na página) -> lista compacta logo abaixo do botão, presa à janela
//   sem anchor (painel Estrutura)               -> diálogo central com um cartão por tipo
import { useLayoutEffect, useRef } from "react";
import { useEditor } from "../state/context.js";
import { BlockIcon } from "../ui/BlockIcon.jsx";

const GAP = 10, MARGIN = 8;

export function BlockPicker({ position, anchor, total, onPick, onPickShared, onClose }) {
  const { schema, shared } = useEditor();
  const dialog = useRef(null);
  const isOpen = position !== null;
  const compact = isOpen && !!anchor;

  // Abre antes de posicionar (os dois efeitos de layout rodam nesta ordem): fechado, não tem tamanho.
  useLayoutEffect(() => {
    const d = dialog.current;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  // Posição da lista compacta: abaixo do "+" (ou acima, se não couber), sempre dentro da janela.
  useLayoutEffect(() => {
    const d = dialog.current;
    if (!d.open) return;
    if (!compact) { d.style.removeProperty("left"); d.style.removeProperty("top"); return; }
    const { width, height } = d.getBoundingClientRect();
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - width / 2, MARGIN), window.innerWidth - width - MARGIN);
    let top = anchor.bottom + GAP;
    if (top + height > window.innerHeight - MARGIN) top = Math.max(MARGIN, anchor.top - GAP - height);
    d.style.left = `${left}px`;
    d.style.top = `${top}px`;
  }, [compact, anchor]);

  const where = position === null || position >= total ? "no final da página" : `na posição ${position + 1}`;
  return (
    <dialog ref={dialog} className={`picker block-picker${compact ? " compact" : ""}`} aria-labelledby="block-picker-title" onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="picker-head">
        <h2 id="block-picker-title">Inserir bloco {where}</h2>
        {!compact && <button type="button" className="btn btn-sm btn-outline" onClick={() => dialog.current.close()}>Fechar</button>}
      </div>
      <div className="block-types">
        {Object.entries(schema.blocks).map(([type, def]) => (
          <button key={type} type="button" className="block-type" onClick={() => onPick(type)} title={compact ? def.help : undefined}>
            <BlockIcon type={type} />
            <strong>{def.label}</strong>
            {!compact && <span className="muted small">{def.help}</span>}
          </button>
        ))}
      </div>
      {/* Blocos salvos (aba "Blocos salvos"): o conteúdo vem de lá e muda em todas as páginas. */}
      {shared.list.length > 0 && (
        <>
          <h3 className="block-types-title">Blocos salvos</h3>
          <div className="block-types">
            {shared.list.map((s) => (
              <button key={s.id} type="button" className="block-type" onClick={() => onPickShared(s)}
                title={compact ? `${schema.blocks[s.type].label} · muda junto em todas as páginas que o usam` : undefined}>
                <BlockIcon type={s.type} />
                <strong>{s.name}</strong>
                {!compact && <span className="muted small">{schema.blocks[s.type].label} salvo: muda junto em todas as páginas que o usam.</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </dialog>
  );
}
