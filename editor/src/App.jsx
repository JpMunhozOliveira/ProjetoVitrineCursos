// Editor da página de vendas (React). Coordena: carregamento, estado da página, salvar,
// publicar e a ligação editor <-> pré-visualização ao vivo.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { EditorContext } from "./context.js";
import { withKeys, stripKeys, carryKeys, newBlock } from "./state.js";
import { historyReducer, initialHistory } from "./history.js";
import { BlockList } from "./Blocks.jsx";
import { Preview } from "./Preview.jsx";
import { BlockPicker } from "./BlockPicker.jsx";
import { ThemePicker, resolveTheme } from "./ThemePicker.jsx";

const api = (...args) => window.Admin.api(...args);
const STATUS = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };

export default function App({ productId }) {
  const [boot, setBoot] = useState({ status: "loading" });  // loading | error | ready
  // Estado da página com histórico (desfazer/refazer). Ver history.js.
  const [history, rawDispatch] = useReducer(historyReducer, initialHistory);
  const doc = history.doc;
  const dirty = history.doc !== history.saved; // compara com a versão salva no servidor
  // Cada alteração leva o horário: o histórico junta digitação contínua num passo só.
  const dispatch = useCallback((action) => rawDispatch({ ...action, time: Date.now() }), []);
  const undo = useCallback(() => rawDispatch({ type: "undo" }), []);
  const redo = useCallback(() => rawDispatch({ type: "redo" }), []);
  const [page, setPage] = useState(null);                    // página como está GRAVADA
  const [media, setMedia] = useState(() => new Map());
  const [open, setOpen] = useState(() => new Set());         // chaves dos blocos abertos
  const [selected, setSelected] = useState({ key: null, from: null });
  const [device, setDevice] = useState("desktop");
  const [message, setMessage] = useState({ text: "", kind: "" });
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(null);               // bloco sob o mouse (destaca na prévia)
  const [visible, setVisible] = useState(null);               // índices que aparecem na página (da prévia)
  const [pickerAt, setPickerAt] = useState(null);             // posição onde inserir (null = seletor fechado)
  const pendingFocus = useRef(null);

  // Altura do cabeçalho fixo do painel -> variável CSS. Com ela, a tela do editor ocupa exatamente
  // o resto da janela: só a coluna do editor rola e a pré-visualização fica sempre inteira à vista.
  useEffect(() => {
    const top = document.querySelector(".admin-top");
    if (!top) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty("--top-offset", `${top.offsetHeight}px`));
    observer.observe(top);
    return () => observer.disconnect();
  }, []);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  /* ---------- Integração com o resto do painel (common.js) ---------- */
  useEffect(() => {
    window.Admin.hasUnsavedChanges = () => dirtyRef.current; // proteção dos links internos e do "Sair"
    const onBeforeUnload = (e) => { if (dirtyRef.current && !window.Admin.leaving) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Atalhos: Ctrl+Z desfaz; Ctrl+Shift+Z ou Ctrl+Y refaz (Cmd no Mac). Valem também dentro dos
  // campos de texto: o histórico do editor substitui o do navegador, que não conhece os blocos.
  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (document.querySelector("dialog[open]")) return; // diálogo aberto: não mexe na página por baixo
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

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
            theme: resolveTheme(saved.theme, schema),
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
    sections: doc.sections, seo_title: doc.seo_title, seo_description: doc.seo_description, theme: doc.theme,
  }), [doc?.sections, doc?.seo_title, doc?.seo_description, doc?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

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
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-block-key="${block._key}"]`);
      card?.scrollIntoView({ block: "start", behavior: "smooth" });
      card?.querySelector(".block-toggle")?.focus({ preventScroll: true });
    });
  }

  function addBlock(type, index) {
    const block = newBlock(type, schema);
    setPickerAt(null);
    dispatch({ type: "insert", path: ["sections"], index, value: block });
    setOpen((prev) => new Set(prev).add(block._key));
    setSelected({ key: block._key, from: "editor" });
    focusLater(`[data-block-key="${block._key}"] .block-toggle`);
    requestAnimationFrame(() => document.querySelector(`[data-block-key="${block._key}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function start(fromTemplate) {
    const initial = withKeys(fromTemplate ? structuredClone(schema.defaultSections) : [], schema);
    dispatch({ type: "start", doc: { sections: initial, seo_title: "", seo_description: "", published: false, theme: resolveTheme(null, schema) } });
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
      // "saved" (e não "load"): o histórico continua — dá para desfazer o que veio antes de salvar.
      dispatch({ type: "saved", doc: {
        sections: withKeys(carryKeys(saved.sections, doc.sections), schema),
        seo_title: saved.seo_title || "", seo_description: saved.seo_description || "", published: !!saved.published_at,
        theme: resolveTheme(saved.theme, schema),
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
  const productUrl = `produto.html?id=${encodeURIComponent(productId)}`;

  // Tamanho da pré-visualização: ícones de monitor e celular (fica no cabeçalho para a
  // pré-visualização ganhar altura).
  const deviceToggle = (
    <div className="segmented device-toggle" role="radiogroup" aria-label="Tamanho da tela da pré-visualização">
      {[["desktop", "Computador", "M3 4h18v12H3zM8 20h8M12 16v4"], ["mobile", "Celular", "M7 2h10v20H7zM11 18h2"]].map(([value, label, d]) => (
        <label key={value} title={label}>
          <input type="radio" name="device" value={value} checked={device === value} onChange={() => setDevice(value)} aria-label={label} />
          <span><svg className="device-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg></span>
        </label>
      ))}
    </div>
  );

  // Rascunho / Publicada (no cabeçalho, ao lado de "Abrir versão salva"), com a explicação logo abaixo.
  const pending = doc && (page ? doc.published !== !!page.published_at : doc.published);
  const pubHint = doc && ((!doc.published ? "Página em rascunho: só você vê, pela pré-visualização."
    : product.status !== "published"
      ? `Atenção: o produto está como “${STATUS[product.status]}”. A página só aparece para o público quando o produto também estiver publicado.`
      : `Página publicada: visível para o público em /p/${product.slug}.`) + (pending ? " Salve para aplicar." : ""));
  const publishToggle = doc && (
    <div className="segmented publish-toggle" role="radiogroup" aria-label="Situação da página" aria-describedby="pub-hint">
      <label><input type="radio" name="published" value="no" checked={!doc.published}
        onChange={() => dispatch({ type: "set", path: ["published"], value: false })} /><span>Rascunho</span></label>
      <label><input type="radio" name="published" value="yes" checked={doc.published}
        onChange={() => dispatch({ type: "set", path: ["published"], value: true })} /><span>Publicada</span></label>
    </div>
  );

  // Cabeçalho compacto (uma linha) para sobrar altura para o editor e a pré-visualização.
  // "Voltar ao produto" fica na barra de baixo, junto do Salvar.
  const header = (
    <>
    <div className="page-head editor-head">
      <h1 className="editor-title">Página de vendas <span className="muted">· {product.title}</span></h1>
      <div className="row-actions">
        {live && <a className="btn btn-sm btn-outline" href={`/p/${encodeURIComponent(product.slug)}`} target="_blank" rel="noopener">Ver publicada<span className="sr-only"> (abre em nova aba)</span></a>}
        {page && <a className="btn btn-sm btn-outline" href={`/admin/preview/${encodeURIComponent(productId)}`} target="_blank" rel="noopener">Abrir versão salva<span className="sr-only"> (abre em nova aba)</span></a>}
        {publishToggle}
        {doc && (
          <div className="history-buttons" role="group" aria-label="Histórico de alterações">
            <button type="button" className="icon-btn" onClick={undo} disabled={!history.past.length}
              title="Desfazer (Ctrl+Z)" aria-label="Desfazer" aria-keyshortcuts="Control+Z">↶</button>
            <button type="button" className="icon-btn" onClick={redo} disabled={!history.future.length}
              title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer" aria-keyshortcuts="Control+Shift+Z">↷</button>
          </div>
        )}
        {doc && deviceToggle}
      </div>
    </div>
    {doc && <p id="pub-hint" className={`hint pub-hint${pending || (doc.published && product.status !== "published") ? " warn" : ""}`}>{pubHint}</p>}
    </>
  );

  // Telas pequenas: o editor lado a lado não cabe; mostramos este aviso (via CSS) no lugar dele.
  const unsupported = (
    <div className="editor-unsupported" role="note">
      <h2>Editor disponível no computador</h2>
      <p>A edição da página de vendas precisa de uma tela com pelo menos 1024 px de largura, para mostrar o editor e a pré-visualização lado a lado.</p>
      <div className="row-actions">
        {page && <a className="btn btn-outline" href={`/admin/preview/${encodeURIComponent(productId)}`} target="_blank" rel="noopener">Ver versão salva<span className="sr-only"> (abre em nova aba)</span></a>}
        <a className="btn" href={productUrl}>Voltar ao produto</a>
      </div>
    </div>
  );

  if (!doc) {
    return (
      <div className="editor-shell">
        {unsupported}
        <div className="editor-main">
          {header}
          <section className="start-box" aria-labelledby="start-title">
            <h2 id="start-title">Este produto ainda não tem página de vendas</h2>
            <p>Comece pelo modelo padrão — a mesma estrutura da página do Manual, com textos de orientação para você substituir — ou monte do zero.</p>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => start(true)}>Usar o modelo padrão</button>
              <button type="button" className="btn btn-outline" onClick={() => start(false)}>Começar em branco</button>
              <a className="btn btn-outline" href={productUrl}>Voltar ao produto</a>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={context}>
     <div className="editor-shell">
      {unsupported}
      <div className="editor-main">
      {header}

      <div className="editor-layout">
        <form className="page-editor" noValidate onSubmit={save}>
          <p className="hint">Clique numa seção da pré-visualização (ou no nome de um bloco) para editar. Preço e link de compra vêm do cadastro do produto.</p>
          <BlockList sections={sections} open={open} selectedKey={selected.key} visible={visible}
            onToggle={toggle} onHover={setHovered}
            onInsert={(position) => sections.length < schema.maxBlocks && setPickerAt(position)} />

          <button type="button" className="add-block-btn" disabled={sections.length >= schema.maxBlocks}
            onClick={() => setPickerAt(sections.length)}>
            <span aria-hidden="true">+</span> Adicionar bloco
            {sections.length >= schema.maxBlocks && <span className="muted small"> (limite de {schema.maxBlocks} blocos)</span>}
          </button>
          <BlockPicker position={pickerAt} total={sections.length}
            onPick={(type) => addBlock(type, pickerAt)} onClose={() => setPickerAt(null)} />

          <ThemePicker theme={doc.theme} />

          <fieldset className="seo">
            <legend>Busca e compartilhamento</legend>
            <div className="field">
              <label htmlFor="seo_title">Título da página</label>
              <input id="seo_title" maxLength={220} value={doc.seo_title} aria-describedby="seo-title-help"
                onChange={(e) => dispatch({ type: "set", path: ["seo_title"], value: e.target.value, merge: true })} />
              <p id="seo-title-help" className="hint">Aparece na aba do navegador, no Google e na prévia do link no WhatsApp. Vazio = título do produto.</p>
            </div>
            <div className="field">
              <label htmlFor="seo_description">Descrição</label>
              <textarea id="seo_description" rows={2} maxLength={320} value={doc.seo_description} aria-describedby="seo-desc-help"
                onChange={(e) => dispatch({ type: "set", path: ["seo_description"], value: e.target.value, merge: true })} />
              <p id="seo-desc-help" className="hint">Uma ou duas frases (até 320 caracteres). Vazio = resumo do produto.</p>
            </div>
          </fieldset>

          <div className="form-actions editor-actions">
            <p className={`msg ${message.kind}`} role="status" aria-live="polite">{message.text}</p>
            <div className="buttons">
              <a className="btn btn-outline" href={`produto.html?id=${encodeURIComponent(productId)}`}>Voltar</a>
              <button type="submit" className="btn" disabled={saving}>Salvar</button>
            </div>
          </div>
        </form>

        <aside className="preview-pane" aria-label="Pré-visualização">
          <Preview productId={productId} payload={previewPayload} device={device}
            selectedIndex={selectedIndex >= 0 ? selectedIndex : null}
            scrollToSelected={selected.from === "editor"}
            onSelectBlock={(index) => revealBlock(index, "preview")}
            hoveredIndex={hovered} onVisibleChange={setVisible} />
        </aside>
      </div>
      </div>
     </div>
    </EditorContext.Provider>
  );
}
