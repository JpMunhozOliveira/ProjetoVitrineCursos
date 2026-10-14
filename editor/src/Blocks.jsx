// Lista de blocos da página: cada bloco é um cartão recolhível com o formulário do seu tipo.
import { useId } from "react";
import { useEditor } from "./context.js";
import { Field } from "./fields.jsx";

// Resumo exibido no cabeçalho do bloco (o primeiro texto que identifica o conteúdo).
function summary(block) {
  const first = (block.items || [])[0] || {};
  return block.title || block.name || first.title || first.question || first.text || "";
}

function BlockCard({ block, index, total, isOpen, isSelected, onToggle, onRemove }) {
  const { schema, dispatch, focusLater } = useEditor();
  const def = schema.blocks[block.type];
  const bodyId = useId();
  const label = def.label;

  function move(delta, action) {
    dispatch({ type: "move", path: ["sections"], from: index, to: index + delta });
    focusLater(`[data-block-key="${block._key}"] [data-action="${action}"]`); // foco volta ao botão usado
  }

  return (
    <li className={`block${isSelected ? " is-selected" : ""}`} data-block-key={block._key}>
      <div className="block-head">
        <button type="button" className="block-toggle" data-action="toggle"
          aria-expanded={isOpen} aria-controls={bodyId} onClick={onToggle}>
          <span className="block-name">{index + 1}. {label}</span>
          <span className="block-summary muted">{summary(block)}</span>
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
        {/* Só monta os campos quando aberto: páginas grandes ficam leves */}
        {isOpen && Object.entries(def.fields).map(([name, field]) => (
          <Field key={name} field={field} value={block[name]} path={["sections", index, name]} />
        ))}
      </div>
    </li>
  );
}

export function BlockList({ sections, open, selectedKey, onToggle }) {
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
    const next = sections[index + 1] || sections[index - 1];
    focusLater(next ? `[data-block-key="${next._key}"] .block-toggle` : "#new-type");
  }

  if (!sections.length) return <p className="empty muted">Nenhum bloco. Use “Adicionar bloco”, abaixo.</p>;
  return (
    <ol className="blocks">
      {sections.map((block, index) => (
        <BlockCard key={block._key} block={block} index={index} total={sections.length}
          isOpen={open.has(block._key)} isSelected={selectedKey === block._key}
          onToggle={() => onToggle(block._key)} onRemove={() => remove(block, index)} />
      ))}
    </ol>
  );
}
