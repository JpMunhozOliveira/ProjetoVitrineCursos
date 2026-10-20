// Painel em janela flutuante, acima da barra de ferramentas de baixo (a página ocupa a tela
// inteira e continua editável com ele aberto). Três modos:
//   block     -> campos do bloco selecionado que não se editam na página: imagens, ícones,
//                ✓/✗ e adicionar / remover / reordenar itens de lista (os textos também aparecem)
//   structure -> visão geral: lista de blocos com arrastar e soltar (BlockList)
//   page      -> "Cores e SEO": cores da página e busca/compartilhamento
import { useEffect, useRef } from "react";
import { useEditor } from "../state/context.js";
import { Field } from "./Fields.jsx";
import { BlockIcon } from "../ui/BlockIcon.jsx";

export const PANEL_LABELS = { block: "Bloco", structure: "Estrutura", page: "Cores e SEO" };

function BlockFields({ block, index, hidden }) {
  const { schema } = useEditor();
  if (!block) {
    return <p className="hint panel-empty">Selecione um bloco na página (clique nele) para ver as imagens, os ícones e os itens dele.</p>;
  }
  const def = schema.blocks[block.type];
  return (
    <div key={block._key} className="block-fields">
      <h3 className="panel-block-title"><BlockIcon type={block.type} /> <span className="block-number">{index + 1}</span> {def.label}</h3>
      {def.help && <p className="hint block-help">{def.help}</p>}
      {hidden && <p className="hint warn">Este bloco não aparece na página no momento: preencha o conteúdo principal (ex.: itens da lista ou imagens).</p>}
      {Object.entries(def.fields).map(([name, field]) => (
        <Field key={name} field={field} value={block[name]} path={["sections", index, name]} />
      ))}
    </div>
  );
}

export function SidePanel({ mode, onMode, onClose, block, blockIndex, blockHidden, structure, page }) {
  // Janela flutuante (não modal): a página continua clicável por trás. Ao abrir, o foco vem para
  // a janela; ao fechar pelo ✕ ou Esc, volta para o botão da barra de baixo que a abre.
  const box = useRef(null);
  useEffect(() => { box.current?.focus({ preventScroll: true }); }, []);
  function close() {
    onClose();
    document.querySelector(`.editor-dock [data-panel="${mode}"]`)?.focus();
  }
  return (
    <aside ref={box} tabIndex={-1} className="side-panel floating-panel" aria-label={`Painel: ${PANEL_LABELS[mode]}`}
      onKeyDown={(e) => { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("dialog[open]")) close(); }}>
      <div className="side-panel-head">
        <div className="segmented panel-tabs" role="radiogroup" aria-label="Conteúdo do painel">
          {Object.entries(PANEL_LABELS).map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="panel-mode" value={value} checked={mode === value} onChange={() => onMode(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label="Fechar painel" title="Fechar (Esc)" onClick={close}>✕</button>
      </div>
      <div className="side-panel-body">
        {mode === "block" && <BlockFields block={block} index={blockIndex} hidden={blockHidden} />}
        {mode === "structure" && structure}
        {mode === "page" && page}
      </div>
    </aside>
  );
}
