// Lista de blocos da página: cada bloco é um cartão recolhível com o formulário do seu tipo.
import { Fragment, useId } from "react";
import { useEditor } from "../state/context.js";
import { duplicateBlock } from "../state/document.js";
import { BlockIcon } from "../ui/BlockIcon.jsx";
import { BlockFormBody } from "./SharedBlock.jsx";
import { Icon } from "./CanvasOverlay.jsx";
import { SortableList, useSortableItem, DragHandle } from "../ui/dnd.jsx";
import { plain } from "../state/richtext.js";

// Resumo exibido no cabeçalho do bloco (o primeiro texto que identifica o conteúdo), sem as
// marcações de formatação.
function summary(block, shared) {
  if (block.shared) {
    const saved = shared.list.find((s) => s.id === block.shared);
    return saved ? `Bloco salvo: ${saved.name}` : "Bloco salvo não encontrado";
  }
  const first = (block.items || [])[0] || {};
  return plain(block.title || block.name || first.title || first.question || first.text || "");
}

function BlockCard({ block, index, total, isOpen, isSelected, isHidden, onToggle, onRemove, onDuplicate, onHover }) {
  const { schema, dispatch, focusLater, shared } = useEditor();
  const def = schema.blocks[block.type];
  const bodyId = useId();
  const label = def.label;
  const { itemRef, itemStyle, isDragging, handleProps } = useSortableItem(block._key);

  function move(delta, action) {
    dispatch({ type: "move", path: ["sections"], from: index, to: index + delta });
    focusLater(`[data-block-key="${block._key}"] [data-action="${action}"]`); // foco volta ao botão usado
  }

  return (
    <li ref={itemRef} style={itemStyle}
      className={`block${isSelected ? " is-selected" : ""}${isHidden ? " is-hidden" : ""}${isDragging ? " is-dragging" : ""}`} data-block-key={block._key}
      onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}>
      <div className="block-head">
        <DragHandle handleProps={handleProps} label={`Arrastar bloco ${index + 1} (${label})`} />
        <button type="button" className="block-toggle" data-action="toggle"
          aria-expanded={isOpen} aria-controls={bodyId} onClick={onToggle}
          onFocus={() => onHover(index)} onBlur={() => onHover(null)}>
          <span className="block-badge"><BlockIcon type={block.type} /></span>
          <span className="block-text">
            <span className="block-name"><span className="block-number">{index + 1}</span> {label}</span>
            <span className="block-summary muted">{summary(block, shared) || "Sem título"}</span>
          </span>
          {isHidden && <span className="block-flag" title="Este bloco não tem conteúdo suficiente para aparecer na página">Não aparece</span>}
        </button>
        <div className="tools">
          <button type="button" className="icon-btn" data-action="up" disabled={index === 0}
            aria-label={`Mover bloco ${index + 1} (${label}) para cima`} onClick={() => move(-1, "up")}>↑</button>
          <button type="button" className="icon-btn" data-action="down" disabled={index === total - 1}
            aria-label={`Mover bloco ${index + 1} (${label}) para baixo`} onClick={() => move(1, "down")}>↓</button>
          <button type="button" className="icon-btn" data-action="duplicate" disabled={total >= schema.maxBlocks}
            aria-label={`Duplicar bloco ${index + 1} (${label})`} title="Duplicar" onClick={onDuplicate}><Icon name="duplicate" /></button>
          <button type="button" className="icon-btn danger"
            aria-label={`Remover bloco ${index + 1} (${label})`} onClick={onRemove}>✕</button>
        </div>
      </div>
      <div className="block-body" id={bodyId} hidden={!isOpen}>
        {def.help && <p className="hint block-help">{def.help}</p>}
        {isHidden && !block.shared && (
          <p className="hint warn">Este bloco não aparece na página no momento: preencha o conteúdo principal (ex.: itens da lista ou imagens).</p>
        )}
        {/* Só monta os campos quando aberto: páginas grandes ficam leves */}
        {isOpen && <BlockFormBody block={block} index={index} />}
      </div>
    </li>
  );
}

// Linha "+ Inserir bloco aqui" entre os cartões.
function InsertHere({ position, onInsert }) {
  return (
    <li className="insert-here">
      <button type="button" onClick={() => onInsert(position)} aria-label={`Inserir bloco na posição ${position + 1}`}>
        <span aria-hidden="true">+</span> Inserir bloco aqui
      </button>
    </li>
  );
}

export function BlockList({ sections, open, selectedKey, visible, onToggle, onHover, onInsert, onDuplicated }) {
  const { schema, dispatch, focusLater } = useEditor();

  async function remove(block, index) {
    const label = schema.blocks[block.type].label;
    const ok = await window.Admin.confirm({
      title: `Remover o bloco “${label}”?`,
      text: "O conteúdo deste bloco será perdido quando você salvar.",
      action: "Remover bloco", danger: true,
    });
    if (!ok) return;
    dispatch({ type: "remove", path: ["sections"], index });
    onHover(null);
    const next = sections[index + 1] || sections[index - 1];
    focusLater(next ? `[data-block-key="${next._key}"] .block-toggle` : ".add-block-btn");
  }

  // A cópia entra logo abaixo do original, já aberta e com o foco.
  function duplicate(block, index) {
    if (sections.length >= schema.maxBlocks) return;
    const copy = duplicateBlock(block, schema);
    dispatch({ type: "insert", path: ["sections"], index: index + 1, value: copy });
    onDuplicated(copy._key, open.has(block._key));
    focusLater(`[data-block-key="${copy._key}"] .block-toggle`);
  }

  // Arrastar e soltar usa a mesma ação "move" dos botões ↑ ↓ (e entra no desfazer igual).
  const ids = sections.map((b) => b._key);
  const labelOf = (key) => {
    const i = ids.indexOf(key);
    return `Bloco ${i + 1} (${schema.blocks[sections[i].type].label})`;
  };
  function moveTo(from, to) {
    dispatch({ type: "move", path: ["sections"], from, to });
    focusLater(`[data-block-key="${sections[from]._key}"] .drag-handle`);
  }

  if (!sections.length) return <p className="empty muted">Nenhum bloco ainda. Use “Adicionar bloco”, abaixo.</p>;
  return (
    <SortableList ids={ids} label={labelOf} onMove={moveTo}>
      <ol className="blocks">
        {sections.map((block, index) => (
          <Fragment key={block._key}>
            {index > 0 && <InsertHere position={index} onInsert={onInsert} />}
            <BlockCard block={block} index={index} total={sections.length}
              isOpen={open.has(block._key)} isSelected={selectedKey === block._key}
              isHidden={visible !== null && !visible.has(index)}
              onToggle={() => onToggle(block._key)} onRemove={() => remove(block, index)}
              onDuplicate={() => duplicate(block, index)} onHover={onHover} />
          </Fragment>
        ))}
      </ol>
    </SortableList>
  );
}
