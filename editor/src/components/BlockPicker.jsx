// Escolha do tipo de bloco: um diálogo com um cartão por tipo (ícone, nome e descrição).
// Usa o <dialog> nativo: foco preso no diálogo, Esc fecha e o fundo fica bloqueado.
import { useEffect, useRef } from "react";
import { useEditor } from "../state/context.js";
import { BlockIcon } from "../ui/BlockIcon.jsx";

export function BlockPicker({ position, total, onPick, onClose }) {
  const { schema } = useEditor();
  const dialog = useRef(null);
  const isOpen = position !== null;

  useEffect(() => {
    const d = dialog.current;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  const where = position === null || position >= total ? "no final da página" : `na posição ${position + 1}`;
  return (
    <dialog ref={dialog} className="picker block-picker" aria-labelledby="block-picker-title" onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="picker-head">
        <h2 id="block-picker-title">Inserir bloco {where}</h2>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => dialog.current.close()}>Fechar</button>
      </div>
      <div className="block-types">
        {Object.entries(schema.blocks).map(([type, def]) => (
          <button key={type} type="button" className="block-type" onClick={() => onPick(type)}>
            <BlockIcon type={type} />
            <strong>{def.label}</strong>
            <span className="muted small">{def.help}</span>
          </button>
        ))}
      </div>
    </dialog>
  );
}
