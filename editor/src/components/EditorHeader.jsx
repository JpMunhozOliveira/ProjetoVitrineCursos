// Cabeçalho do editor em duas linhas:
//   1) Voltar · título (cortado com "…") · situação · Salvar rascunho · Publicar (ações principais)
//   2) desfazer/refazer | computador/celular | painéis Estrutura e Página | abrir em nova aba · mensagem
// Logo abaixo, a explicação da situação da página.
import { PRODUCT_STATUS } from "../labels.js";

const DEVICES = [
  ["desktop", "Computador", "M3 4h18v12H3zM8 20h8M12 16v4"],
  ["mobile", "Celular", "M7 2h10v20H7zM11 18h2"],
];

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
          <span><svg className="device-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg></span>
        </label>
      ))}
    </div>
  );
}

// editing = false: tela inicial (sem página ainda) — mostra só título e links.
export function EditorHeader({ product, productId, productUrl, page, dirty, editing, canUndo, canRedo, onUndo, onRedo,
  device, onDevice, saving, onSave, onPublish, panel, onPanel, message }) {
  const live = !!(page?.published_at && product.status === "published");
  const pub = publishState({ page, dirty, product });
  const togglePanel = (mode) => onPanel(panel === mode ? null : mode);

  return (
    <>
      <div className="page-head editor-head">
        <a className="btn btn-sm btn-outline back-link" href={productUrl}><span aria-hidden="true">←</span> Voltar</a>
        <h1 className="editor-title" title={product.title}>Página de vendas <span className="muted">· {product.title}</span></h1>
        {editing && (
          <div className="publish-controls">
            <span className={`pub-badge ${pub.state}`}>
              {{ never: "Nunca publicada", changes: "Alterações não publicadas", live: "Publicada · em dia" }[pub.state]}
            </span>
            <button type="button" className="btn btn-sm btn-outline save-btn" disabled={saving} onClick={onSave}
              aria-keyshortcuts="Control+S" title="Salvar rascunho (Ctrl+S) — não muda o site">
              {dirty && <span className="dirty-dot" aria-hidden="true" />}Salvar rascunho
              {dirty && <span className="sr-only"> (há alterações não salvas)</span>}
            </button>
            <button type="button" className="btn btn-sm btn-publish" disabled={saving || pub.state === "live"}
              onClick={onPublish} aria-describedby="pub-hint">
              {pub.everPublished ? "Publicar alterações" : "Publicar"}
            </button>
          </div>
        )}
      </div>
      {editing && (
        <div className="editor-toolbar">
          <div className="toolbar-group history-buttons" role="group" aria-label="Histórico de alterações">
            <button type="button" className="icon-btn" onClick={onUndo} disabled={!canUndo}
              title="Desfazer (Ctrl+Z)" aria-label="Desfazer" aria-keyshortcuts="Control+Z">↶</button>
            <button type="button" className="icon-btn" onClick={onRedo} disabled={!canRedo}
              title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer" aria-keyshortcuts="Control+Shift+Z">↷</button>
          </div>
          <div className="toolbar-group"><DeviceToggle device={device} onChange={onDevice} /></div>
          <div className="toolbar-group" role="group" aria-label="Painéis">
            <button type="button" className="btn btn-sm btn-outline" aria-pressed={panel === "structure"} onClick={() => togglePanel("structure")}>Estrutura</button>
            <button type="button" className="btn btn-sm btn-outline" aria-pressed={panel === "page"} onClick={() => togglePanel("page")}
              title="Cores da página, título e descrição para busca e compartilhamento">Cores e SEO</button>
          </div>
          {(page || live) && (
            <div className="toolbar-group" role="group" aria-label="Abrir em nova aba">
              {page && <a className="btn btn-sm btn-outline" href={`/admin/preview/${encodeURIComponent(productId)}`} target="_blank" rel="noopener">Versão salva<span className="sr-only"> (abre em nova aba)</span></a>}
              {live && <a className="btn btn-sm btn-outline" href={`/p/${encodeURIComponent(product.slug)}`} target="_blank" rel="noopener">Ver publicada<span className="sr-only"> (abre em nova aba)</span></a>}
            </div>
          )}
          <p className={`msg toolbar-msg ${message.kind}`} role="status" aria-live="polite">{message.text}</p>
        </div>
      )}
      {editing && <p id="pub-hint" className={`hint pub-hint${pub.warn ? " warn" : ""}`}>{pub.hint}</p>}
    </>
  );
}
