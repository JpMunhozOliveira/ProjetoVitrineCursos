// Blocos salvos (aba "Blocos salvos" do painel): conteúdo usado em várias páginas, como as redes
// sociais ou o bloco Autor de um professor (qualquer tipo de bloco pode ser salvo). Na página fica só a referência { type, shared: id, ...campos locais }.
//   BlockFormBody    -> formulário de um bloco no painel (escolhe entre os dois abaixo)
//   SharedLinkFields -> bloco vinculado: qual bloco salvo usar, campos locais (fundo),
//                       editar na aba, desvincular (vira cópia editável só desta página)
//   SaveAsShared     -> bloco comum de um tipo compartilhável: cria o bloco salvo a partir dele
import { useId, useState } from "react";
import { useEditor } from "../state/context.js";
import { stripKeys, withKeys } from "../state/document.js";
import { Field } from "./Fields.jsx";

// Editor visual de um bloco salvo.
const editUrl = (id) => `pagina.html?bloco=${encodeURIComponent(id)}`;

// Campos que ficam na página (ex.: fundo) e os que vêm do bloco salvo.
export const localNames = (schema, type) => schema.shareable?.[type] || [];
export const isShareable = (schema, type) => Object.hasOwn(schema.shareable || {}, type);

// Exemplo de nome no campo "Nome do bloco salvo", conforme o tipo (ex.: "Autor — Prof. Fulano").
const nameExample = (schema, type) => `${schema.blocks[type]?.label || "Bloco"} — Prof. Fulano`;

// Modo bloco salvo: nome do bloco (só aparece no painel), no topo do painel do bloco.
export function SharedNameField({ value }) {
  const { dispatch } = useEditor();
  const id = useId();
  return (
    <div className="field shared-name">
      <label htmlFor={id}>Nome do bloco salvo</label>
      <input id={id} value={value} maxLength={120} aria-describedby={`${id}-help`}
        onChange={(e) => dispatch({ type: "set", path: ["name"], value: e.target.value, merge: true })} />
      <p id={`${id}-help`} className="hint">Só aparece no painel, para você achar o bloco.</p>
    </div>
  );
}

function pickFields(block, names) {
  return Object.fromEntries(names.filter((n) => Object.hasOwn(block, n)).map((n) => [n, block[n]]));
}

function SharedLinkFields({ block, index }) {
  const { schema, dispatch, shared } = useEditor();
  const id = useId();
  const saved = shared.list.find((s) => s.id === block.shared);
  const options = shared.list.filter((s) => s.type === block.type);
  const fields = schema.blocks[block.type].fields;
  const local = localNames(schema, block.type);

  // Desvincular: o conteúdo atual do bloco salvo vira uma cópia desta página (volta a ser editável).
  async function unlink() {
    const ok = await window.Admin.confirm({
      title: "Desvincular este bloco?",
      text: `O conteúdo de “${saved.name}” será copiado para esta página. Depois disso, mudanças no bloco salvo não chegam mais aqui.`,
      action: "Desvincular",
    });
    if (!ok) return;
    const copy = withKeys([{ ...structuredClone(saved.data), ...pickFields(block, local), type: block.type }], schema)[0];
    dispatch({ type: "set", path: ["sections", index], value: { ...copy, _key: block._key } });
  }

  return (
    <div className="shared-link">
      <p className="hint shared-note">
        {saved
          ? <>Este bloco vem do bloco salvo <strong>“{saved.name}”</strong>. O conteúdo é editado no <a href={editUrl(saved.id)} target="_blank" rel="noopener">editor do bloco salvo<span className="sr-only"> (abre em nova aba)</span></a> e muda em todas as páginas que o usam.</>
          : <>O bloco salvo deste bloco não existe mais. Escolha outro abaixo ou remova o bloco.</>}
      </p>
      <div className="field">
        <label htmlFor={id}>Bloco salvo usado</label>
        <select id={id} value={saved ? block.shared : ""}
          onChange={(e) => dispatch({ type: "set", path: ["sections", index, "shared"], value: e.target.value })}>
          {!saved && <option value="" disabled>Escolha um bloco salvo</option>}
          {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {local.map((name) => (
        <Field key={name} field={fields[name]} value={block[name]} path={["sections", index, name]} />
      ))}
      {saved && (
        <div className="row-actions">
          <a className="btn btn-sm btn-outline" href={editUrl(saved.id)} target="_blank" rel="noopener">Editar o bloco salvo<span className="sr-only"> (abre em nova aba)</span></a>
          <button type="button" className="btn btn-sm btn-outline" onClick={unlink}>Desvincular desta página</button>
        </div>
      )}
    </div>
  );
}

// Corpo do formulário de um bloco (painel Bloco e cartão do painel Estrutura): bloco vinculado
// mostra a ligação com o bloco salvo; bloco comum mostra os campos (e, se o tipo for
// compartilhável, a opção de virar bloco salvo).
// Campo com showIf (esquema do servidor): só aparece quando o outro campo do bloco tem um dos
// valores (ex.: o link do vídeo só no estilo Vídeo). O valor continua guardado.
function isShown(field, block, schema) {
  const rule = field.showIf;
  if (!rule) return true;
  const value = block[rule.field] ?? schema.blocks[block.type].fields[rule.field]?.default;
  return rule.in.includes(value);
}

export function BlockFormBody({ block, index }) {
  const { schema, isShared } = useEditor();
  if (block.shared) return <SharedLinkFields block={block} index={index} />;
  return (
    <>
      {Object.entries(schema.blocks[block.type].fields).filter(([, field]) => isShown(field, block, schema)).map(([name, field]) => (
        <Field key={name} field={field} value={block[name]} path={["sections", index, name]} />
      ))}
      {!isShared && isShareable(schema, block.type) && <SaveAsShared block={block} index={index} />}
    </>
  );
}

function SaveAsShared({ block, index }) {
  const { schema, dispatch, shared } = useEditor();
  const id = useId();
  const [name, setName] = useState("");
  const [state, setState] = useState({ busy: false, error: "" });
  const local = localNames(schema, block.type);

  async function create() {
    if (!name.trim()) { setState({ busy: false, error: `Dê um nome ao bloco salvo (ex.: ${nameExample(schema, block.type)}).` }); return; }
    setState({ busy: true, error: "" });
    const content = stripKeys(block);
    const data = Object.fromEntries(Object.entries(content).filter(([k]) => k !== "type" && !local.includes(k)));
    try {
      const created = await window.Admin.api("/shared-blocks", { method: "POST", body: { type: block.type, name, data } });
      shared.add(created);
      dispatch({ type: "set", path: ["sections", index], value: {
        type: block.type, shared: created.id, ...pickFields(content, local), _key: block._key,
      } });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }

  return (
    <details className="save-shared">
      <summary>Usar este bloco em outras páginas</summary>
      <p className="hint">Cria um bloco salvo com este conteúdo (aba Blocos salvos) e liga esta página a ele.
        Depois, as mudanças feitas lá valem para todas as páginas que o usam. Salve a página para manter o vínculo.</p>
      <div className="field">
        <label htmlFor={id}>Nome do bloco salvo</label>
        <input id={id} value={name} maxLength={120} placeholder={`Ex.: ${nameExample(schema, block.type)}`}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} />
      </div>
      {state.error && <p className="hint warn" role="alert">{state.error}</p>}
      <button type="button" className="btn btn-sm" disabled={state.busy} onClick={create}>
        {state.busy ? "Criando…" : "Salvar como bloco salvo"}
      </button>
    </details>
  );
}
