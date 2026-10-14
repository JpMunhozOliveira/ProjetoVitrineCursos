// Editor da página de vendas (React). Coordena: carregamento, estado da página, salvar,
// publicar e a ligação editor <-> pré-visualização ao vivo.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { EditorContext } from "./context.js";
import { reducer, withKeys, stripKeys, carryKeys, newBlock } from "./state.js";
import { BlockList } from "./Blocks.jsx";
import { Preview } from "./Preview.jsx";

const api = (...args) => window.Admin.api(...args);
const STATUS = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };

// Estado = página em edição + "há alterações não salvas?". "load" (dados do servidor) zera o aviso.
function appReducer(state, action) {
  return { doc: reducer(state.doc, action), dirty: action.type !== "load" };
}

export default function App({ productId }) {
  const [boot, setBoot] = useState({ status: "loading" });  // loading | error | ready
  const [{ doc, dirty }, dispatch] = useReducer(appReducer, { doc: null, dirty: false });
  const [page, setPage] = useState(null);                    // página como está GRAVADA
  const [media, setMedia] = useState(() => new Map());
  const [open, setOpen] = useState(() => new Set());         // chaves dos blocos abertos
  const [selected, setSelected] = useState({ key: null, from: null });
  const [device, setDevice] = useState("desktop");
  const [tab, setTab] = useState("edit");                    // telas estreitas: edit | preview
  const [message, setMessage] = useState({ text: "", kind: "" });
  const [saving, setSaving] = useState(false);
  const pendingFocus = useRef(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  /* ---------- Integração com o resto do painel (common.js) ---------- */
  useEffect(() => {
    window.Admin.hasUnsavedChanges = () => dirtyRef.current; // proteção dos links internos e do "Sair"
    const onBeforeUnload = (e) => { if (dirtyRef.current && !window.Admin.leaving) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Foco depois de redesenhar (ex.: ao mover um bloco, o foco volta ao botão usado).
  const focusLater = useCallback((selector) => { pendingFocus.current = selector; }, []);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const target = document.querySelector(pendingFocus.current);
    pendingFocus.current = null;
    if (target) target.focus();
  });

  /* ---------- Carregamento ---------- */
  useEffect(() => {
    (async () => {
      try {
        await window.Admin.requireSession();
        if (!productId) throw new Error("Produto não informado.");
        const [product, saved, schema, library] = await Promise.all([
          api(`/products/${encodeURIComponent(productId)}`),
          api(`/products/${encodeURIComponent(productId)}/sales-page`),
          api("/sales-blocks"),
          api("/media"),
        ]);
        setMedia(new Map(library.map((m) => [m.id, m])));
        setPage(saved);
        document.title = `Página de vendas: ${product.title} — Painel administrativo`;
        if (saved) {
          dispatch({ type: "load", doc: {
            sections: withKeys(saved.sections, schema), seo_title: saved.seo_title || "",
            seo_description: saved.seo_description || "", published: !!saved.published_at,
          } });
        }
        setBoot({ status: "ready", product, schema });
      } catch (err) {
        setBoot({ status: "error", text: err.message });
      }
    })();
  }, [productId]);

  const schema = boot.schema;
  const product = boot.product;
  const sections = doc?.sections || [];
  const selectedIndex = selected.key ? sections.findIndex((b) => b._key === selected.key) : -1;

  // O que vai para a pré-visualização (sem _key e sem "publicada", que não muda a aparência).
  const previewPayload = useMemo(() => doc && stripKeys({
    sections: doc.sections, seo_title: doc.seo_title, seo_description: doc.seo_description,
  }), [doc?.sections, doc?.seo_title, doc?.seo_description]); // eslint-disable-line react-hooks/exhaustive-deps

  const context = useMemo(() => ({
    dispatch, schema, media, focusLater,
    addMedia: (m) => setMedia((prev) => new Map(prev).set(m.id, m)),
  }), [schema, media, focusLater]);

  /* ---------- Seleção e abertura de blocos ---------- */
  function toggle(key) {
    const opening = !open.has(key);
    setOpen((prev) => {
      const next = new Set(prev);
      if (opening) next.add(key); else next.delete(key);
      return next;
    });
    if (opening) setSelected({ key, from: "editor" }); // abrir no editor rola a pré-visualização até o bloco
  }

  // Abre um bloco e rola o EDITOR até ele (clique na pré-visualização ou erro do servidor).
  function revealBlock(index, from) {
    const block = sections[index];
    if (!block) return;
    setOpen((prev) => new Set(prev).add(block._key));
    setSelected({ key: block._key, from });
    setTab("edit");
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-block-key="${block._key}"]`);
      card?.scrollIntoView({ block: "start", behavior: "smooth" });
      card?.querySelector(".block-toggle")?.focus({ preventScroll: true });
    });
  }

  function addBlock(type) {
    const block = newBlock(type, schema);
    dispatch({ type: "insert", path: ["sections"], value: block });
    setOpen((prev) => new Set(prev).add(block._key));
    setSelected({ key: block._key, from: "editor" });
    focusLater(`[data-block-key="${block._key}"] .block-toggle`);
    requestAnimationFrame(() => document.querySelector(`[data-block-key="${block._key}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function start(fromTemplate) {
    const initial = withKeys(fromTemplate ? structuredClone(schema.defaultSections) : [], schema);
    dispatch({ type: "load", doc: { sections: initial, seo_title: "", seo_description: "", published: false } });
    dispatch({ type: "set", path: ["published"], value: false }); // marca como alterado (ainda não salvo)
    if (initial[0]) { setOpen(new Set([initial[0]._key])); setSelected({ key: initial[0]._key, from: "editor" }); }
    setMessage(fromTemplate
      ? { text: "Modelo padrão carregado. Substitua os textos de orientação e salve.", kind: "success" }
      : { text: "", kind: "" });
  }

  /* ---------- Salvar ---------- */
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "Salvando…", kind: "" });
    try {
      const saved = await api(`/products/${encodeURIComponent(productId)}/sales-page`, {
        method: "PUT", body: stripKeys(doc),
      });
      setPage(saved);
      // A resposta traz os blocos como foram gravados; as chaves antigas mantêm os blocos abertos.
      dispatch({ type: "load", doc: {
        sections: withKeys(carryKeys(saved.sections, doc.sections), schema),
        seo_title: saved.seo_title || "", seo_description: saved.seo_description || "", published: !!saved.published_at,
      } });
      setMessage({ text: `Página salva às ${new Date().toLocaleTimeString("pt-BR")}.`, kind: "success" });
    } catch (err) {
      setMessage({
        text: err.status === 401
          ? "Sua sessão expirou. Entre novamente em outra aba e clique em Salvar de novo (os dados desta tela foram mantidos)."
          : err.message,
        kind: "error",
      });
      const where = /^Bloco (\d+)/.exec(err.message || ""); // "Bloco 3 (FAQ) › ..." -> abre o bloco 3
      if (where) revealBlock(Number(where[1]) - 1, "error");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Telas ---------- */
  if (boot.status === "loading") return <p className="msg" role="status">Carregando…</p>;
  if (boot.status === "error") return <p className="msg error" role="alert">{boot.text}</p>;

  const live = !!(page?.published_at && product.status === "published");
  const header = (
    <>
      <a className="crumb" href={`produto.html?id=${encodeURIComponent(productId)}`}>← Voltar ao produto</a>
      <div className="page-head">
        <div>
          <h1>Página de vendas</h1>
          <p className="muted">{product.title}</p>
        </div>
        <div className="row-actions">
          {live && <a className="btn btn-sm btn-outline" href={`/p/${encodeURIComponent(product.slug)}`} target="_blank" rel="noopener">Ver publicada<span className="sr-only"> (abre em nova aba)</span></a>}
          {page && <a className="btn btn-sm btn-outline" href={`/admin/preview/${encodeURIComponent(productId)}`} target="_blank" rel="noopener">Abrir versão salva<span className="sr-only"> (abre em nova aba)</span></a>}
        </div>
      </div>
    </>
  );

  if (!doc) {
    return (
      <>
        {header}
        <section className="start-box" aria-labelledby="start-title">
          <h2 id="start-title">Este produto ainda não tem página de vendas</h2>
          <p>Comece pelo modelo padrão — a mesma estrutura da página do Manual, com textos de orientação para você substituir — ou monte do zero.</p>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => start(true)}>Usar o modelo padrão</button>
            <button type="button" className="btn btn-outline" onClick={() => start(false)}>Começar em branco</button>
          </div>
        </section>
      </>
    );
  }

  const pending = page ? doc.published !== !!page.published_at : doc.published;
  const pubHint = (!doc.published ? "Só você vê, pela pré-visualização."
    : product.status !== "published"
      ? `Atenção: o produto está como “${STATUS[product.status]}”. A página só aparece para o público quando o produto também estiver publicado.`
      : `Visível para o público em /p/${product.slug}.`) + (pending ? " Salve para aplicar." : "");

  return (
    <EditorContext.Provider value={context}>
      {header}
      {/* Telas estreitas: editor e pré-visualização viram abas */}
      <div className="editor-tabs" role="tablist" aria-label="Modo de visualização">
        <button type="button" role="tab" aria-selected={tab === "edit"} onClick={() => setTab("edit")}>Editar</button>
        <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>Ver página</button>
      </div>

      <div className="editor-layout" data-tab={tab}>
        <form className="page-editor" noValidate onSubmit={save}>
          <p className="hint">Clique numa seção da pré-visualização (ou no nome de um bloco) para editar. Preço e link de compra vêm do cadastro do produto.</p>
          <BlockList sections={sections} open={open} selectedKey={selected.key} onToggle={toggle} />

          <div className="add-block">
            <label htmlFor="new-type">Adicionar bloco</label>
            <select id="new-type" defaultValue="faq">
              {Object.entries(schema.blocks).map(([type, def]) => <option key={type} value={type}>{def.label}</option>)}
            </select>
            <button type="button" className="btn btn-sm btn-outline" disabled={sections.length >= schema.maxBlocks}
              onClick={() => addBlock(document.getElementById("new-type").value)}>Adicionar no final</button>
          </div>

          <fieldset className="seo">
            <legend>Busca e compartilhamento</legend>
            <div className="field">
              <label htmlFor="seo_title">Título da página</label>
              <input id="seo_title" maxLength={220} value={doc.seo_title} aria-describedby="seo-title-help"
                onChange={(e) => dispatch({ type: "set", path: ["seo_title"], value: e.target.value })} />
              <p id="seo-title-help" className="hint">Aparece na aba do navegador, no Google e na prévia do link no WhatsApp. Vazio = título do produto.</p>
            </div>
            <div className="field">
              <label htmlFor="seo_description">Descrição</label>
              <textarea id="seo_description" rows={2} maxLength={320} value={doc.seo_description} aria-describedby="seo-desc-help"
                onChange={(e) => dispatch({ type: "set", path: ["seo_description"], value: e.target.value })} />
              <p id="seo-desc-help" className="hint">Uma ou duas frases (até 320 caracteres). Vazio = resumo do produto.</p>
            </div>
          </fieldset>

          <div className="form-actions">
            <div className="status-picker" role="radiogroup" aria-labelledby="pub-label" aria-describedby="pub-hint">
              <span id="pub-label" className="status-label">Página</span>
              <div className="segmented">
                <label><input type="radio" name="published" value="no" checked={!doc.published}
                  onChange={() => dispatch({ type: "set", path: ["published"], value: false })} /><span>Rascunho</span></label>
                <label><input type="radio" name="published" value="yes" checked={doc.published}
                  onChange={() => dispatch({ type: "set", path: ["published"], value: true })} /><span>Publicada</span></label>
              </div>
              <span id="pub-hint" className={`hint${pending || (doc.published && product.status !== "published") ? " warn" : ""}`}>{pubHint}</span>
            </div>
            <div className="buttons">
              <a className="btn btn-outline" href={`produto.html?id=${encodeURIComponent(productId)}`}>Voltar</a>
              <button type="submit" className="btn" disabled={saving}>Salvar</button>
            </div>
            <p className={`msg ${message.kind}`} role="status" aria-live="polite">{message.text}</p>
          </div>
        </form>

        <aside className="preview-pane" aria-label="Pré-visualização">
          <div className="segmented device-toggle" role="radiogroup" aria-label="Tamanho da tela">
            {[["desktop", "Computador"], ["mobile", "Celular"]].map(([value, label]) => (
              <label key={value}><input type="radio" name="device" value={value} checked={device === value}
                onChange={() => setDevice(value)} /><span>{label}</span></label>
            ))}
          </div>
          <Preview productId={productId} payload={previewPayload} device={device}
            selectedIndex={selectedIndex >= 0 ? selectedIndex : null}
            scrollToSelected={selected.from === "editor"}
            onSelectBlock={(index) => revealBlock(index, "preview")} />
        </aside>
      </div>
    </EditorContext.Provider>
  );
}
