// Pré-visualização ao vivo: o SERVIDOR renderiza o rascunho (mesmo template da página pública)
// e o HTML é exibido numa moldura (iframe srcdoc). Assim o que você vê é exatamente o que o
// público verá — não uma imitação feita no editor.
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 500; // espera uma pausa na digitação antes de pedir nova renderização

export function Preview({ productId, payload, selectedIndex, scrollToSelected, onSelectBlock, device, hoveredIndex, onVisibleChange }) {
  const frame = useRef(null);
  const scrollY = useRef(0);          // posição da rolagem, mantida entre atualizações
  const requestId = useRef(0);        // descarta respostas atrasadas (fora de ordem)
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState({ kind: "loading", text: "Carregando pré-visualização…" });
  // O ouvinte de clique vive dentro do iframe; a ref garante que ele chame sempre a versão
  // atual da função (sem ela, ficaria "congelada" na versão do momento em que foi registrado).
  const onSelectRef = useRef(onSelectBlock);
  onSelectRef.current = onSelectBlock;
  const onVisibleRef = useRef(onVisibleChange);
  onVisibleRef.current = onVisibleChange;

  // Pede nova renderização quando o conteúdo muda (com debounce).
  useEffect(() => {
    const id = ++requestId.current;
    setStatus((s) => (s.kind === "error" ? s : { kind: "loading", text: "Atualizando…" }));
    const timer = setTimeout(async () => {
      try {
        const result = await window.Admin.api(`/products/${encodeURIComponent(productId)}/sales-page/preview`, {
          method: "POST", body: payload, text: true,
        });
        if (id !== requestId.current) return;
        setHtml(result);
        // Quais blocos o servidor de fato desenhou: os que faltam "não aparecem" (ex.: galeria sem imagens).
        onVisibleRef.current?.(new Set([...result.matchAll(/data-block="(\d+)"/g)].map((m) => Number(m[1]))));
        setStatus({ kind: "ok", text: "Atualizada" });
      } catch (err) {
        if (id !== requestId.current) return;
        setStatus({ kind: "error", text: err.message }); // mantém a última versão válida na tela
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [productId, payload]);

  // Destaca o bloco selecionado e, se pedido, rola a pré-visualização até ele.
  function highlight(doc, shouldScroll) {
    if (!doc) return;
    doc.querySelectorAll("[data-block].is-selected").forEach((n) => n.classList.remove("is-selected"));
    const target = selectedIndex === null ? null : doc.querySelector(`[data-block="${selectedIndex}"]`);
    if (target) {
      target.classList.add("is-selected");
      if (shouldScroll) target.scrollIntoView?.({ block: "start", behavior: "smooth" });
    }
  }

  useEffect(() => {
    highlight(frame.current?.contentDocument, scrollToSelected);
  }, [selectedIndex, scrollToSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Passar o mouse sobre um cartão no editor destaca a seção correspondente.
  function hover(doc) {
    if (!doc) return;
    doc.querySelectorAll("[data-block].is-hovered").forEach((n) => n.classList.remove("is-hovered"));
    if (hoveredIndex !== null && hoveredIndex !== undefined) doc.querySelector(`[data-block="${hoveredIndex}"]`)?.classList.add("is-hovered");
  }
  useEffect(() => { hover(frame.current?.contentDocument); }, [hoveredIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rede de segurança: se a moldura chegou a abrir outra página (endereço diferente do da
  // pré-visualização), recriamos o iframe com o HTML atual. O "key" novo força o React a recriá-lo.
  const [frameKey, setFrameKey] = useState(0);

  function handleLoad() {
    const win = frame.current.contentWindow, doc = frame.current.contentDocument;
    if (!doc) return;
    // Só endereço http(s) indica que um link navegou; about:srcdoc (a pré-visualização) e
    // about:blank (moldura ainda vazia) são normais — reagir a eles recriaria o iframe sem parar.
    if (/^https?:/.test(win.location.href)) {
      setFrameKey((k) => k + 1);
      return;
    }
    win.scrollTo(0, scrollY.current);
    win.addEventListener("scroll", () => { scrollY.current = win.scrollY; }, { passive: true });
    doc.documentElement.classList.add("is-editor-preview"); // ativa o destaque ao passar o mouse

    // A pré-visualização não navega: links (clique normal, do meio ou com Ctrl) e formulários são
    // bloqueados na fase de CAPTURA, antes de qualquer outro código da página reagir ao clique.
    const block = (e) => { if (e.target.closest?.("a[href], button[type=submit]")) e.preventDefault(); };
    doc.addEventListener("click", block, true);
    doc.addEventListener("auxclick", block, true);
    doc.addEventListener("submit", (e) => e.preventDefault(), true);

    // Clicar numa seção abre o bloco correspondente no editor.
    doc.addEventListener("click", (e) => {
      const section = e.target.closest("[data-block]");
      if (section && !e.target.closest(".car-btn, .dots, summary")) onSelectRef.current(Number(section.dataset.block));
    });
    highlight(doc, false);
    hover(doc);
  }

  // Escala: a página é desenhada na largura real do dispositivo (1280 px ou 390 px) e reduzida
  // para caber no painel. Sem isso, "computador" num painel de 700 px mostraria o layout de celular.
  const stage = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const logical = device === "mobile" ? 390 : 1280;
  const scale = box.width ? Math.min(1, box.width / logical) : 1;
  const frameStyle = {
    width: `${logical}px`,
    height: `${box.height / scale}px`,
    transform: `scale(${scale})`,
  };

  return (
    <div className="preview">
      <div ref={stage} className={`preview-stage ${device}`}>
        <iframe key={frameKey} ref={frame} title="Pré-visualização da página de vendas" srcDoc={html} onLoad={handleLoad} style={frameStyle} />
      </div>
      {/* Barra de status embaixo da pré-visualização: situação e escala de exibição. */}
      <div className="preview-bar">
        <span className={`preview-status ${status.kind}`} role="status" aria-live="polite">{status.text}</span>
        {scale < 1 && <span className="muted small">{logical} px, exibido a {Math.round(scale * 100)}%</span>}
      </div>
    </div>
  );
}
