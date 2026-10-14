// Campos do formulário, gerados a partir do esquema do servidor (sales/blocks.js).
// Cada campo recebe o "caminho" do valor que edita (ex.: ["sections", 2, "items", 0, "question"])
// e avisa as mudanças com dispatch({ type: "set", path, value }).
import { useId } from "react";
import { useEditor } from "./context.js";
import { emptyValue } from "./state.js";

export function Field({ field, value, path }) {
  switch (field.type) {
    case "list": return <ListField field={field} items={value || []} path={path} />;
    case "image": return <ImageField field={field} value={value} path={path} />;
    case "bool": return <BoolField field={field} value={value} path={path} />;
    case "icon": return <IconField field={field} value={value} path={path} />;
    default: return <TextField field={field} value={value} path={path} />;
  }
}

function Help({ id, text }) {
  return text ? <p id={id} className="hint">{text}</p> : null;
}

function TextField({ field, value, path }) {
  const { dispatch } = useEditor();
  const id = useId();
  const Tag = field.type === "textarea" ? "textarea" : "input";
  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      <Tag
        id={id}
        value={value || ""}
        maxLength={field.max}
        placeholder={field.placeholder}
        rows={field.type === "textarea" ? 3 : undefined}
        aria-describedby={field.help ? `${id}-help` : undefined}
        onChange={(e) => dispatch({ type: "set", path, value: e.target.value })}
      />
      <Help id={`${id}-help`} text={field.help} />
    </div>
  );
}

function IconField({ field, value, path }) {
  const { dispatch, schema } = useEditor();
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      <select id={id} value={value || "check"} onChange={(e) => dispatch({ type: "set", path, value: e.target.value })}>
        {Object.entries(schema.icons).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
      </select>
    </div>
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
        {image && !image.alt_text && <p className="hint warn">Sem texto alternativo: descreva esta imagem na página Imagens.</p>}
      </div>
    </div>
  );
}

// O item tem algum texto digitado? (_key é interna do editor e não conta)
function hasText(item) {
  return Object.entries(item).some(([k, v]) => k !== "_key" && typeof v === "string" && v.trim());
}

function ListField({ field, items, path }) {
  const { dispatch, focusLater } = useEditor();
  const full = items.length >= field.max;

  async function remove(index) {
    const item = items[index];
    if (hasText(item) && !(await window.Admin.confirm({
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

  return (
    <fieldset className="list-field" data-list={path.join(".")}>
      <legend>{field.label} ({items.length} de {field.max})</legend>
      {items.map((item, index) => (
        <div className="list-item" key={item._key} data-key={item._key}>
          <div className="list-item-head">
            <strong className="small">Item {index + 1}</strong>
            <div className="tools">
              <button type="button" className="icon-btn" data-action="up" disabled={index === 0}
                aria-label={`Mover item ${index + 1} para cima`} onClick={() => move(index, -1, "up")}>↑</button>
              <button type="button" className="icon-btn" data-action="down" disabled={index === items.length - 1}
                aria-label={`Mover item ${index + 1} para baixo`} onClick={() => move(index, 1, "down")}>↓</button>
              <button type="button" className="icon-btn danger" aria-label={`Remover item ${index + 1}`} onClick={() => remove(index)}>✕</button>
            </div>
          </div>
          {Object.entries(field.item).map(([name, sub]) => (
            <Field key={name} field={sub} value={item[name]} path={[...path, index, name]} />
          ))}
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline add-item" disabled={full} onClick={add}>+ Adicionar item</button>
    </fieldset>
  );
}
