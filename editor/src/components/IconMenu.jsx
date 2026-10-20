// Escolha de ícone em lista suspensa: busca + ícones por grupo (grupos vêm do esquema do servidor,
// sales/blocks.js). Usada no painel (campo "Ícone") e ao clicar num ícone direto na página.
// É um <dialog> modal, como o menu de inserir bloco: foco preso, Esc e clique fora fecham.
import { useId, useLayoutEffect, useRef, useState } from "react";
import { useEditor } from "../state/context.js";

const GAP = 8, MARGIN = 8;
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Desenho de um ícone do esquema (mesmo traço da página).
export function IconGlyph({ icon }) {
  if (!icon) return null;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={icon.d} fill="none" stroke="currentColor" strokeWidth={icon.width || 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// anchor: retângulo (coordenadas da janela) do que foi clicado; a lista abre logo abaixo dele.
export function IconMenu({ open, anchor, value, title = "Escolher ícone", onPick, onClose }) {
  const { schema } = useEditor();
  const dialog = useRef(null);
  const [query, setQuery] = useState("");
  const titleId = useId();

  // Abre antes de posicionar (fechado, o diálogo não tem tamanho para medir).
  useLayoutEffect(() => {
    const d = dialog.current;
    if (open && !d.open) { setQuery(""); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  // Abaixo do que foi clicado (ou acima, se não couber), sempre dentro da janela.
  useLayoutEffect(() => {
    const d = dialog.current;
    if (!d.open || !anchor) return;
    const { width, height } = d.getBoundingClientRect();
    const left = Math.min(Math.max(anchor.left, MARGIN), window.innerWidth - width - MARGIN);
    let top = anchor.bottom + GAP;
    if (top + height > window.innerHeight - MARGIN) top = Math.max(MARGIN, anchor.top - GAP - height);
    d.style.left = `${left}px`;
    d.style.top = `${top}px`;
  }, [open, anchor]);

  const q = norm(query.trim());
  const groups = (schema.iconGroups || [["Ícones", Object.keys(schema.icons)]])
    .map(([label, keys]) => [label, keys.filter((k) => schema.icons[k] && (!q || norm(`${schema.icons[k].label} ${k}`).includes(q)))])
    .filter(([, keys]) => keys.length);

  return (
    <dialog ref={dialog} className="picker icon-menu" aria-labelledby={titleId} onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="icon-menu-head">
        <h2 id={titleId}>{title}</h2>
        <input type="search" value={query} placeholder="Buscar ícone (ex.: livro, dinheiro)" aria-label="Buscar ícone"
          onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="icon-menu-body">
        {groups.map(([label, keys]) => (
          <section key={label} aria-label={label}>
            <h3>{label}</h3>
            <div className="icon-menu-grid">
              {keys.map((key) => (
                <button key={key} type="button" className="icon-menu-item" aria-pressed={key === value}
                  aria-label={schema.icons[key].label} title={schema.icons[key].label} onClick={() => onPick(key)}>
                  <IconGlyph icon={schema.icons[key]} />
                </button>
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <p className="muted small">Nenhum ícone encontrado.</p>}
      </div>
    </dialog>
  );
}
