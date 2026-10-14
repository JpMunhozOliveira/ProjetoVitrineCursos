// Lista de blocos da página: cada bloco é um cartão recolhível com o formulário do seu tipo.
import { Fragment, useId } from "react";
import { useEditor } from "./context.js";
import { Field } from "./fields.jsx";
import { BlockIcon } from "./icons.jsx";

// Resumo exibido no cabeçalho do bloco (o primeiro texto que identifica o conteúdo).
function summary(block) {
  const first = (block.items || [])[0] || {};
  return block.title || block.name || first.title || first.question || first.text || "";
}

function BlockCard({ block, index, total, isOpen, isSelected, isHidden, onToggle, onRemove, onHover }) {
  const { schema, dispatch, focusLater } = useEditor();
  const def = schema.blocks[block.type];
  const bodyId = useId();
  const label = def.label;

  function move(delta, action) {
    dispatch({ type: "move", path: ["sections"], from: index, to: index + delta });
    focusLater(`[data-block-key="${block._key}"] [data-action="${action}"]`); // foco volta ao botão usado
  }

  return (
    <li className={`block${isSelected ? " is-selected" : ""}${isHidden ? " is-hidden" : ""}`} data-block-key={block._key}
      onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}>
      <div className="block-head">
        <button type="button" className="block-toggle" data-action="toggle"
          aria-expanded={isOpen} aria-controls={bodyId} onClick={onToggle}
          onFocus={() => onHover(index)} onBlur={() => onHover(null)}>
          <span className="block-badge"><BlockIcon type={block.type} /></span>
          <span className="block-text">
            <span className="block-name"><span className="block-number">{index + 1}</span> {label}</span>
            <span className="block-summary muted">{summary(block) || "Sem título"}</span>
          </span>
          {isHidden && <span className="block-flag" title="Este bloco não tem conteúdo suficiente para aparecer na página">Não aparece</span>}
        </button>
        <div className="tools">
          <button type="button" className="icon-btn" data-action="up" disabled={index === 0}
            aria-label={`Mover bloco ${index + 1} (${label}) para cima`} onClick={() => move(-1, "up")}>↑</button>
          <button type="button" className="icon-btn" data-action="down" disabled={index === total - 1}
            aria-label={`Mover bloco ${index + 1} (${label}) para baixo`} onClick={() => move(1, "down")}>↓</button>
          <button type="button" className="icon-btn danger"
            aria-label={`Remover bloco ${index + 1} (${label})`} onClick={onRemove}>✕</button>
        </div>
      </div>
      <div className="block-body" id={bodyId} hidden={!isOpen}>
        {def.help && <p className="hint block-help">{def.help}</p>}
        {isHidden && (
          <p className="hint warn">Este bloco não aparece na página no momento: preencha o conteúdo principal (ex.: itens da lista ou imagens).</p>
        )}
        {/* Só monta os campos quando aberto: páginas grandes ficam leves */}
        {isOpen && Object.entries(def.fields).map(([name, field]) => (
          <Field key={name} field={field} value={block[name]} path={["sections", index, name]} />
        ))}
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

export function BlockList({ sections, open, selectedKey, visible, onToggle, onHover, onInsert }) {
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

  if (!sections.length) return <p className="empty muted">Nenhum bloco ainda. Use “Adicionar bloco”, abaixo.</p>;
  return (
    <ol className="blocks">
      {sections.map((block, index) => (
        <Fragment key={block._key}>
          {index > 0 && <InsertHere position={index} onInsert={onInsert} />}
          <BlockCard block={block} index={index} total={sections.length}
            isOpen={open.has(block._key)} isSelected={selectedKey === block._key}
            isHidden={visible !== null && !visible.has(index)}
            onToggle={() => onToggle(block._key)} onRemove={() => remove(block, index)} onHover={onHover} />
        </Fragment>
      ))}
    </ol>
  );
}
