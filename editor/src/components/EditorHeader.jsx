// Barras do editor, flutuando sobre a página (que ocupa a tela inteira):
//   TopBar  (em cima) -> Voltar · título (cortado com "…") · situação · links · modo noturno · Salvar · Publicar
//   ToolDock (embaixo) -> desfazer/refazer | computador/celular | Estrutura · Cores
// A explicação da situação da página fica no selo (dica ao passar o mouse e texto para leitores de tela).
import { useEffect, useRef } from "react";
import { PRODUCT_STATUS } from "../labels.js";

const DEVICES = [
  ["desktop", "Computador", "M3 4h18v12H3zM8 20h8M12 16v4"],
  ["mobile", "Celular", "M7 2h10v20H7zM11 18h2"],
];

const Glyph = ({ d, className = "bar-icon" }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const EYE = "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const GLOBE = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z";
const LAYERS = "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5";
const PALETTE = "M12 3a9 9 0 0 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.7-1.5 1.7-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 12.5h.01M9.5 8h.01M14.5 8h.01";

// Situação da página: nunca publicada | alterações não publicadas | publicada e em dia.
function publishState({ page, dirty, product }) {
  const everPublished = !!page?.published_at;
  const changes = !page || page.has_unpublished_changes || dirty;
  const state = !everPublished ? "never" : changes ? "changes" : "live";
  const when = everPublished ? new Date(page.published_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
  const productNote = product.status !== "published"
    ? ` O produto está como “${PRODUCT_STATUS[product.status]}”: a página só aparece no site quando o produto for publicado.` : "";
  const hint = {
    never: "Ainda não publicada. “Salvar rascunho” guarda seu trabalho sem mostrar ao público; “Publicar” leva a página ao ar.",
    changes: `Há alterações que o público ainda não vê (a versão no ar é de ${when}). Publique para levá-las ao ar.`,
    live: `Publicada em ${when}. O que você vê aqui é o que está no ar.`,
  }[state] + productNote;
  return { state, everPublished, hint, warn: state === "changes" || !!productNote };
}

function DeviceToggle({ device, onChange }) {
  return (
    <div className="segmented device-toggle" role="radiogroup" aria-label="Tamanho da tela da pré-visualização">
      {DEVICES.map(([value, label, d]) => (
        <label key={value} title={label}>
          <input type="radio" name="device" value={value} checked={device === value} onChange={() => onChange(value)} aria-label={label} />
          <span><Glyph d={d} className="device-icon" /></span>
        </label>
      ))}
    </div>
  );
}

// Botão "Modo noturno" do painel (#tema-btn, ligado por js/theme.js): o mesmo elemento é trazido
// para a barra (e devolvido ao sair), em vez de duplicar a lógica do tema.
function ThemeButtonSlot() {
  const slot = useRef(null);
  useEffect(() => {
    const button = document.getElementById("tema-btn");
    if (!button || !slot.current) return undefined;
    const home = button.parentNode, next = button.nextSibling;
    slot.current.append(button);
    return () => home?.insertBefore(button, next);
  }, []);
  return <span ref={slot} className="theme-slot" />;
}

// editing = false: tela inicial (sem página ainda) — mostra só Voltar e o título.
export function TopBar({ product, productId, productUrl, page, dirty, editing, saving, onSave, onPublish, message }) {
  const live = !!(page?.published_at && product.status === "published");
  const pub = publishState({ page, dirty, product });
  return (
    <header className="editor-topbar">
      <a className="bar-btn back-link" href={productUrl}><span aria-hidden="true">←</span> Voltar</a>
      <h1 className="editor-title" title={product.title}>Página de vendas <span className="muted">· {product.title}</span></h1>
      {editing && (
        <>
          <span className={`pub-badge ${pub.state}${pub.warn ? " warn" : ""}`} title={pub.hint}>
            {{ never: "Nunca publicada", changes: "Alterações não publicadas", live: "Publicada · em dia" }[pub.state]}
          </span>
          <span id="pub-hint" className="sr-only">{pub.hint}</span>
          <p className={`msg toolbar-msg ${message.kind}`} role="status" aria-live="polite">{message.text}</p>
          {(page || live) && (
            <span className="bar-links" role="group" aria-label="Abrir em nova aba">
              {page && (
                <a className="bar-icon-btn" href={`/admin/preview/${encodeURIComponent(productId)}`} target="_blank" rel="noopener" title="Versão salva (abre em nova aba)">
                  <Glyph d={EYE} /><span className="sr-only">Versão salva (abre em nova aba)</span>
                </a>
              )}
              {live && (
                <a className="bar-icon-btn" href={`/p/${encodeURIComponent(product.slug)}`} target="_blank" rel="noopener" title="Ver publicada (abre em nova aba)">
                  <Glyph d={GLOBE} /><span className="sr-only">Ver publicada (abre em nova aba)</span>
                </a>
              )}
            </span>
          )}
        </>
      )}
      <ThemeButtonSlot />
      {editing && (
        <span className="publish-controls">
          <button type="button" className="btn btn-sm btn-outline save-btn" disabled={saving} onClick={onSave}
            aria-keyshortcuts="Control+S" title="Salvar rascunho (Ctrl+S) — não muda o site">
            {dirty && <span className="dirty-dot" aria-hidden="true" />}Salvar rascunho
            {dirty && <span className="sr-only"> (há alterações não salvas)</span>}
          </button>
          <button type="button" className="btn btn-sm btn-publish" disabled={saving || pub.state === "live"}
            onClick={onPublish} aria-describedby="pub-hint">
            {pub.everPublished ? "Publicar alterações" : "Publicar"}
          </button>
        </span>
      )}
    </header>
  );
}

export function ToolDock({ canUndo, canRedo, onUndo, onRedo, device, onDevice, panel, onPanel }) {
  const togglePanel = (mode) => onPanel(panel === mode ? null : mode);
  return (
    <nav className="editor-dock" aria-label="Ferramentas do editor">
      <div className="dock-group history-buttons" role="group" aria-label="Histórico de alterações">
        <button type="button" className="bar-icon-btn" onClick={onUndo} disabled={!canUndo}
          title="Desfazer (Ctrl+Z)" aria-label="Desfazer" aria-keyshortcuts="Control+Z">↶</button>
        <button type="button" className="bar-icon-btn" onClick={onRedo} disabled={!canRedo}
          title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer" aria-keyshortcuts="Control+Shift+Z">↷</button>
      </div>
      <div className="dock-group"><DeviceToggle device={device} onChange={onDevice} /></div>
      <div className="dock-group" role="group" aria-label="Painéis">
        <button type="button" className="bar-btn" data-panel="structure" aria-pressed={panel === "structure"} onClick={() => togglePanel("structure")}>
          <Glyph d={LAYERS} />Estrutura
        </button>
        <button type="button" className="bar-btn" data-panel="page" aria-pressed={panel === "page"} onClick={() => togglePanel("page")}
          title="Cores da página">
          <Glyph d={PALETTE} />Cores
        </button>
      </div>
    </nav>
  );
}
