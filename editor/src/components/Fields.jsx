// Campos do formulário, gerados a partir do esquema do servidor (sales/blocks.js).
// Cada campo recebe o "caminho" do valor que edita (ex.: ["sections", 2, "items", 0, "question"])
// e avisa as mudanças com dispatch({ type: "set", path, value }).
import { useId, useState } from "react";
import { useEditor } from "../state/context.js";
import { emptyValue, hasText } from "../state/document.js";
import { SortableList, useSortableItem, DragHandle } from "../ui/dnd.jsx";
import { IconMenu, IconGlyph } from "./IconMenu.jsx";

// compact: dentro de itens de lista (textos longos começam com 2 linhas em vez de 3).
export function Field({ field, value, path, compact, inline }) {
  switch (field.type) {
    case "list": return <ListField field={field} items={value || []} path={path} />;
    case "image": return <ImageField field={field} value={value} path={path} />;
    case "bool": return <BoolField field={field} value={value} path={path} />;
    case "icon": return <IconField field={field} value={value} path={path} />;
    case "choice": return <ChoiceField field={field} value={value} path={path} />;
    default: return <TextField field={field} value={value} path={path} compact={compact} inline={inline} />;
  }
}

function Help({ id, text }) {
  return text ? <p id={id} className="hint">{text}</p> : null;
}

// inline: item numa linha só — o rótulo fica só para leitores de tela e vira o texto de exemplo da caixa.
// Campos "url" (endereço de link) usam a mesma caixa, do tipo url (teclado certo no celular).
function TextField({ field, value, path, compact, inline }) {
  const { dispatch } = useEditor();
  const id = useId();
  const Tag = field.type === "textarea" ? "textarea" : "input";
  return (
    <div className="field">
      <label htmlFor={id} className={inline ? "sr-only" : undefined}>{field.label}</label>
      <Tag
        id={id}
        type={field.type === "url" ? "url" : undefined}
        inputMode={field.type === "url" ? "url" : undefined}
        spellCheck={field.type === "url" ? false : undefined}
        value={value || ""}
        maxLength={field.max}
        placeholder={field.placeholder || (inline ? field.label : undefined)}
        rows={field.type === "textarea" ? (compact ? 2 : 3) : undefined}
        aria-describedby={field.help ? `${id}-help` : undefined}
        onChange={(e) => dispatch({ type: "set", path, value: e.target.value, merge: true })}
      />
      <Help id={`${id}-help`} text={field.help} />
    </div>
  );
}

// Ícone: botão com o ícone atual que abre a lista suspensa (busca + grupos, ver IconMenu.jsx).
// Os desenhos são os mesmos da página (vêm do esquema do servidor).
function IconField({ field, value, path }) {
  const { dispatch, schema } = useEditor();
  const id = useId();
  const [anchor, setAnchor] = useState(null);
  const current = value || "check";
  const icon = schema.icons[current];
  return (
    <div className="field icon-field">
      <span id={id} className="field-label">{field.label}</span>
      <button type="button" className="icon-select" aria-haspopup="dialog" aria-labelledby={`${id} ${id}-value`}
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <IconGlyph icon={icon} />
        <span id={`${id}-value`}>{icon?.label || current}</span>
        <svg className="caret" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <IconMenu open={!!anchor} anchor={anchor} value={current} title={field.label}
        onPick={(key) => { dispatch({ type: "set", path, value: key }); setAnchor(null); }}
        onClose={() => setAnchor(null)} />
    </div>
  );
}

// Uma opção entre poucas (ex.: fundo da seção): botões lado a lado, radios por baixo.
// Cada opção leva data-option, que o CSS usa para mostrar uma amostra (ex.: a cor do fundo).
function ChoiceField({ field, value, path }) {
  const { dispatch } = useEditor();
  const name = useId();
  const current = value || field.default;
  return (
    <fieldset className="field choice-field">
      <legend>{field.label}</legend>
      <div className="choice-options">
        {Object.entries(field.options).map(([key, label]) => (
          <label key={key} className="choice-option" data-option={key}>
            <input type="radio" name={name} value={key} checked={current === key}
              onChange={() => dispatch({ type: "set", path, value: key })} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <Help text={field.help} />
    </fieldset>
  );
}

function BoolField({ field, value, path }) {
  const { dispatch } = useEditor();
  const id = useId();
  return (
    <div className="field check">
      <input id={id} type="checkbox" checked={!!value} onChange={(e) => dispatch({ type: "set", path, value: e.target.checked })} />
      <label htmlFor={id}>{field.label}</label>
    </div>
  );
}

function ImageField({ field, value, path }) {
  const { dispatch, media, addMedia } = useEditor();
  const labelId = useId();
  const image = value ? media.get(value) : null;

  async function pick() {
    const chosen = await window.Admin.pickImage({ currentId: value });
    if (!chosen) return;
    addMedia(chosen);
    dispatch({ type: "set", path, value: chosen.id });
  }

  return (
    <div className="field image-field" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="field-label">{field.label}{field.required ? " (obrigatória)" : ""}</span>
      <div className="img-thumb">
        {image ? (
          <button type="button" className="media-zoom" aria-label="Ampliar imagem"
            onClick={() => window.Admin.viewImage({ url: image.url, alt: image.alt_text, title: image.original_name || field.label, width: image.width, height: image.height })}>
            <img src={image.url} alt="" width={image.width} height={image.height} />
          </button>
        ) : (
          <span className="muted small">{value ? "Imagem não encontrada" : "Sem imagem"}</span>
        )}
      </div>
      <div className="image-side">
        <div className="row-actions">
          <button type="button" className="btn btn-sm btn-outline" onClick={pick}>{image ? "Trocar" : "Escolher imagem"}</button>
          {value && (
            <button type="button" className="btn btn-sm btn-danger" onClick={() => dispatch({ type: "set", path, value: null })}>Remover</button>
          )}
        </div>
        {field.size && <p className="hint">Tamanho recomendado: {field.size}{field.tip ? ` (${field.tip})` : ""}</p>}
        {image && !image.alt_text && <p className="hint warn">Sem texto alternativo: descreva esta imagem na página Imagens.</p>}
      </div>
    </div>
  );
}

function ListField({ field, items, path }) {
  const { dispatch, focusLater } = useEditor();
  const full = items.length >= field.max;

  async function remove(index) {
    const item = items[index];
    if (hasText(item, field.item) &&!(await window.Admin.confirm({
      title: `Remover o item ${index + 1}?`, text: "O texto deste item será perdido.", action: "Remover", danger: true,
    }))) return;
    dispatch({ type: "remove", path, index });
    const next = items[index + 1] || items[index - 1];
    focusLater(next ? `[data-key="${next._key}"] .field :is(input,textarea,select,button)` : `[data-list="${path.join(".")}"] .add-item`);
  }
  function move(index, delta, action) {
    dispatch({ type: "move", path, from: index, to: index + delta });
    focusLater(`[data-key="${items[index]._key}"] [data-action="${action}"]`);
  }
  function add() {
    const item = emptyValue(field.item);
    dispatch({ type: "insert", path, value: item });
    focusLater(`[data-key="${item._key}"] .field :is(input,textarea,select,button)`); // primeiro campo do item novo
  }

  // Arrastar e soltar: mesma ação "move" dos botões ↑ ↓.
  const ids = items.map((item) => item._key);
  function moveTo(from, to) {
    dispatch({ type: "move", path, from, to });
    focusLater(`[data-key="${items[from]._key}"] .drag-handle`);
  }

  return (
    <fieldset className="list-field" data-list={path.join(".")}>
      <legend>{field.label} ({items.length} de {field.max})</legend>
      <SortableList ids={ids} label={(key) => `Item ${ids.indexOf(key) + 1}`} onMove={moveTo}>
        {items.map((item, index) => (
          <ListItem key={item._key} item={item} index={index} total={items.length} field={field} path={path}
            onMove={move} onRemove={remove} />
        ))}
      </SortableList>
      <button type="button" className="btn btn-sm btn-outline add-item" disabled={full} onClick={add}>+ Adicionar item</button>
    </fieldset>
  );
}

// Um item da lista (componente próprio: hooks como useSortableItem não podem ser chamados num laço).
function ListItem({ item, index, total, field, path, onMove, onRemove }) {
  const { itemRef, itemStyle, isDragging, handleProps } = useSortableItem(item._key);
  // Itens só com campos curtos (texto de uma linha / liga-desliga) ficam numa linha só:
  // ⠿ [campos] [↑ ↓ ✕] — sem o título "Item N" ocupando uma linha a mais.
  const inline = Object.values(field.item).every((f) => f.type === "text" || f.type === "url" || f.type === "bool");

  const tools = (
    <div className="tools">
      <button type="button" className="icon-btn" data-action="up" disabled={index === 0}
        aria-label={`Mover item ${index + 1} para cima`} onClick={() => onMove(index, -1, "up")}>↑</button>
      <button type="button" className="icon-btn" data-action="down" disabled={index === total - 1}
        aria-label={`Mover item ${index + 1} para baixo`} onClick={() => onMove(index, 1, "down")}>↓</button>
      <button type="button" className="icon-btn danger" aria-label={`Remover item ${index + 1}`} onClick={() => onRemove(index)}>✕</button>
    </div>
  );
  const fields = (
    // Campos lado a lado (grade): curtos dividem a linha; textos longos, imagens e ícones ocupam a largura toda
    <div className={`item-fields${inline ? " inline" : ""}`}>
      {Object.entries(field.item).map(([name, sub]) => (
        <Field key={name} field={sub} value={item[name]} path={[...path, index, name]} compact inline={inline} />
      ))}
    </div>
  );

  return (
    <div ref={itemRef} style={itemStyle} className={`list-item${inline ? " inline" : ""}${isDragging ? " is-dragging" : ""}`}
      data-key={item._key} role="group" aria-label={`Item ${index + 1}`}>
      {inline ? (
        <>
          <DragHandle handleProps={handleProps} label={`Arrastar item ${index + 1}`} />
          {fields}
          {tools}
        </>
      ) : (
        <>
          <div className="list-item-head">
            <DragHandle handleProps={handleProps} label={`Arrastar item ${index + 1}`} />
            <strong className="small">Item {index + 1}</strong>
            {tools}
          </div>
          {fields}
        </>
      )}
    </div>
  );
}
