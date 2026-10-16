// Editor da página de vendas (React). Coordena: carregamento, estado da página, salvar,
// publicar e a ligação editor <-> pré-visualização ao vivo. A interface fica nos componentes
// (components/); o estado e o histórico, em state/.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { EditorContext } from "./state/context.js";
import { withKeys, stripKeys, carryKeys, newBlock } from "./state/document.js";
import { historyReducer, initialHistory } from "./state/history.js";
import { PRODUCT_STATUS } from "./labels.js";
import { EditorHeader } from "./components/EditorHeader.jsx";
import { StartScreen, UnsupportedNotice } from "./components/StartScreen.jsx";
import { BlockList } from "./components/BlockList.jsx";
import { BlockPicker } from "./components/BlockPicker.jsx";
import { ThemePicker, resolveTheme } from "./components/ThemePicker.jsx";
import { SeoFields } from "./components/SeoFields.jsx";
import { Preview } from "./components/Preview.jsx";

const api = (...args) => window.Admin.api(...args);

export default function App({ productId }) {
  const [boot, setBoot] = useState({ status: "loading" });  // loading | error | ready
  // Estado da página com histórico (desfazer/refazer). Ver state/history.js.
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
            seo_description: saved.seo_description || "",
            theme: resolveTheme(saved.theme, schema),
          } });
        }
        setBoot({ status: "ready", product, schema });
      } catch (err) {
        setBoot({ status: "error", text: err.message });
      }
    })();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const schema = boot.schema;
  const product = boot.product;
  const sections = doc?.sections || [];
  const selectedIndex = selected.key ? sections.findIndex((b) => b._key === selected.key) : -1;

  // O que vai para a pré-visualização (sem _key).
  const previewPayload = useMemo(() => doc && stripKeys({
    sections: doc.sections, seo_title: doc.seo_title, seo_description: doc.seo_description, theme: doc.theme,
  }), [doc?.sections, doc?.seo_title, doc?.seo_description, doc?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Edição direta na página (pré-visualização) ----------
     Texto digitado na página já está na tela: não redesenha a moldura a cada letra (o cursor
     pularia). renderKey muda em todas as outras alterações e quando se sai da edição de texto. */
  const [renderKey, setRenderKey] = useState(0);
  const fromCanvas = useRef(false);   // a última alteração veio da digitação na página?
  const canvasPending = useRef(false); // há texto digitado na página ainda não redesenhado?
  useEffect(() => {
    if (!previewPayload) return;
    if (fromCanvas.current) { fromCanvas.current = false; canvasPending.current = true; return; }
    canvasPending.current = false;
    setRenderKey((k) => k + 1);
  }, [previewPayload]);

  const canvas = {
    schema, sections, undo, redo,
    edit(path, value) {
      fromCanvas.current = true;
      dispatch({ type: "set", path, value, merge: true });
    },
    select: (index) => revealBlock(index, "canvas"),
    deselect: () => setSelected({ key: null, from: null }),
    leave() {
      if (!canvasPending.current) return;
      canvasPending.current = false;
      setRenderKey((k) => k + 1);
    },
  };

  const context = useMemo(() => ({
    dispatch, schema, media, focusLater,
    addMedia: (m) => setMedia((prev) => new Map(prev).set(m.id, m)),
  }), [dispatch, schema, media, focusLater]);

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
  // from "canvas": começou a editar um texto na página — o foco fica lá, não vai para o formulário.
  function revealBlock(index, from) {
    const block = sections[index];
    if (!block) return;
    if (from === "canvas" && selected.key === block._key) return; // já selecionado (outro texto do mesmo bloco)
    setOpen((prev) => new Set(prev).add(block._key));
    setSelected({ key: block._key, from });
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-block-key="${block._key}"]`);
      card?.scrollIntoView({ block: "start", behavior: "smooth" });
      if (from !== "canvas") card?.querySelector(".block-toggle")?.focus({ preventScroll: true });
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
    dispatch({ type: "start", doc: { sections: initial, seo_title: "", seo_description: "", theme: resolveTheme(null, schema) } });
    if (initial[0]) { setOpen(new Set([initial[0]._key])); setSelected({ key: initial[0]._key, from: "editor" }); }
    setMessage(fromTemplate
      ? { text: "Modelo padrão carregado. Substitua os textos de orientação e salve.", kind: "success" }
      : { text: "", kind: "" });
  }

  /* ---------- Salvar rascunho e publicar ---------- */
  function showError(err) {
    setMessage({
      text: err.status === 401
        ? "Sua sessão expirou. Entre novamente em outra aba e tente de novo (os dados desta tela foram mantidos)."
        : err.message,
      kind: "error",
    });
    const where = /^Bloco (\d+)/.exec(err.message || ""); // "Bloco 3 (FAQ) › ..." -> abre o bloco 3
    if (where) revealBlock(Number(where[1]) - 1, "error");
  }

  // Salva o RASCUNHO (nunca muda o site). Devolve a página salva, ou null se deu erro.
  async function saveDraft() {
    const sent = doc; // o que foi enviado (a pessoa pode continuar editando durante o salvamento)
    try {
      const saved = await api(`/products/${encodeURIComponent(productId)}/sales-page`, {
        method: "PUT", body: stripKeys(sent),
      });
      setPage(saved);
      // A resposta traz os blocos como foram gravados; as chaves antigas mantêm os blocos abertos.
      // "saved" (e não "load"): o histórico continua — dá para desfazer o que veio antes de salvar.
      dispatch({ type: "saved", sent, doc: {
        sections: withKeys(carryKeys(saved.sections, sent.sections), schema),
        seo_title: saved.seo_title || "", seo_description: saved.seo_description || "",
        theme: resolveTheme(saved.theme, schema),
      } });
      return saved;
    } catch (err) {
      showError(err);
      return null;
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "Salvando rascunho…", kind: "" });
    if (await saveDraft()) {
      setMessage({ text: `Rascunho salvo às ${new Date().toLocaleTimeString("pt-BR")}. O site só muda quando você publicar.`, kind: "success" });
    }
    setSaving(false);
  }

  // Publica: salva o rascunho (se houver algo não salvo) e leva essa versão ao ar.
  async function publish() {
    const visibleOnSite = product.status === "published";
    const ok = await window.Admin.confirm({
      title: page?.published_at ? "Publicar as alterações?" : "Publicar a página?",
      text: visibleOnSite
        ? `A versão atual do editor ficará visível para o público em /p/${product.slug}.`
        : `A versão atual ficará pronta para o público, mas só aparece no site quando o produto “${product.title}” estiver como Publicado (hoje: ${PRODUCT_STATUS[product.status]}).`,
      action: page?.published_at ? "Publicar alterações" : "Publicar",
      cancel: "Continuar editando",
    });
    if (!ok) return;
    setSaving(true);
    setMessage({ text: "Publicando…", kind: "" });
    if (dirty || !page) {
      if (!(await saveDraft())) { setSaving(false); return; }
    }
    try {
      const published = await api(`/products/${encodeURIComponent(productId)}/sales-page/publish`, { method: "POST" });
      setPage(published);
      setMessage({
        text: visibleOnSite ? `Publicada às ${new Date().toLocaleTimeString("pt-BR")}: já está no ar.` : "Publicada. Aparece no site quando o produto for publicado.",
        kind: "success",
      });
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Telas ---------- */
  if (boot.status === "loading") return <p className="msg" role="status">Carregando…</p>;
  if (boot.status === "error") return <p className="msg error" role="alert">{boot.text}</p>;

  const productUrl = `produto.html?id=${encodeURIComponent(productId)}`;
  const header = (
    <EditorHeader product={product} productId={productId} page={page} dirty={dirty} editing={!!doc}
      canUndo={history.past.length > 0} canRedo={history.future.length > 0} onUndo={undo} onRedo={redo}
      device={device} onDevice={setDevice} saving={saving} onPublish={publish} />
  );
  const unsupported = <UnsupportedNotice productId={productId} productUrl={productUrl} hasPage={!!page} />;

  if (!doc) {
    return (
      <div className="editor-shell">
        {unsupported}
        <div className="editor-main">
          {header}
          <StartScreen productUrl={productUrl} onStart={start} />
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
              <BlockList sections={sections} open={open} selectedKey={selected.key} visible={visible}
                onToggle={toggle} onHover={setHovered}
                onDuplicated={(key, wasOpen) => {
                  if (wasOpen) setOpen((prev) => new Set(prev).add(key));
                  setSelected({ key, from: "editor" });
                }}
                onInsert={(position) => sections.length < schema.maxBlocks && setPickerAt(position)} />

              <button type="button" className="add-block-btn" disabled={sections.length >= schema.maxBlocks}
                onClick={() => setPickerAt(sections.length)}>
                <span aria-hidden="true">+</span> Adicionar bloco
                {sections.length >= schema.maxBlocks && <span className="muted small"> (limite de {schema.maxBlocks} blocos)</span>}
              </button>
              <BlockPicker position={pickerAt} total={sections.length}
                onPick={(type) => addBlock(type, pickerAt)} onClose={() => setPickerAt(null)} />

              <ThemePicker theme={doc.theme} />
              <SeoFields title={doc.seo_title} description={doc.seo_description} />

              <div className="form-actions editor-actions">
                <p className={`msg ${message.kind}`} role="status" aria-live="polite">{message.text}</p>
                <div className="buttons">
                  <a className="btn btn-outline" href={productUrl}>Voltar</a>
                  <button type="submit" className="btn btn-outline" disabled={saving}>Salvar rascunho</button>
                </div>
              </div>
            </form>

            <aside className="preview-pane" aria-label="Pré-visualização">
              <Preview productId={productId} payload={previewPayload} renderKey={renderKey} canvas={canvas} device={device}
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
