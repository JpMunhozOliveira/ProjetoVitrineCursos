// Barra de formatação do texto em edição na página: negrito, itálico, cor e alinhamento.
// Fica acima do texto (abaixo, se não couber), dentro da moldura, no mesmo <div> dos outros
// controles (CanvasOverlay). Cada ação mexe no conteúdo editável e dispara "input": o
// CanvasEditing converte o conteúdo em marcações (state/richtext.js) e grava no estado do
// editor, então desfazer, "não salvo" e salvar funcionam como na digitação.
//
// Sem trecho selecionado, negrito, itálico e cor valem para o texto todo.
import { useEffect, useState } from "react";
import { COLOR_KEYS, ALIGN_KEYS, SENTINELS } from "../state/richtext.js";

const FIELD = "[data-field]";
const COLOR_SPANS = 'span[class*="tx-c-"], font[color]';

const ALIGN_ICONS = {
  left: "M4 6h16M4 10h10M4 14h16M4 18h10",
  center: "M4 6h16M7 10h10M4 14h16M7 18h10",
  right: "M4 6h16M10 10h10M4 14h16M10 18h10",
  justify: "M4 6h16M4 10h16M4 14h16M4 18h16",
};

function Glyph({ d }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Campo de texto da página que está com o foco (ou null).
function activeEl(doc) {
  const el = doc.activeElement;
  return doc.hasFocus() && el?.matches?.(FIELD) && el.isContentEditable ? el : null;
}

// Sem seleção dentro do campo: seleciona o texto todo (a ação vale para ele inteiro).
function selectionIn(doc, el) {
  const selection = doc.getSelection();
  const inside = selection.rangeCount && el.contains(selection.getRangeAt(0).commonAncestorContainer);
  if (!inside || selection.isCollapsed) {
    const range = doc.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  return selection;
}

const changed = (el) => el.dispatchEvent(new (el.ownerDocument.defaultView.Event)("input", { bubbles: true }));

// Troca <font color="sentinela"> (resultado do execCommand) por <span class="tx-c-…">.
function applyColorSpans(el) {
  const keyOf = Object.fromEntries(Object.entries(SENTINELS).map(([k, v]) => [v, k]));
  el.querySelectorAll("font[color]").forEach((font) => {
    const key = keyOf[font.getAttribute("color").toLowerCase()];
    if (!key) { font.replaceWith(...font.childNodes); return; }
    const span = el.ownerDocument.createElement("span");
    span.className = `tx-c-${key}`;
    span.append(...font.childNodes);
    font.replaceWith(span);
  });
}

export function TextToolbar({ doc, scale, labels }) {
  const [el, setEl] = useState(null);
  const [, setTick] = useState(0); // estado dos botões (negrito ativo etc.) muda com a seleção
  const [colorsOpen, setColorsOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      // Foco na própria barra (navegação pelo teclado): continua valendo o texto de antes.
      const inBar = doc.activeElement?.closest?.(".eo-text-toolbar");
      setEl((prev) => {
        const next = inBar && prev?.isConnected ? prev : activeEl(doc);
        if (prev !== next) setColorsOpen(false);
        return next;
      });
      setTick((t) => t + 1);
    };
    // focusout: espera o foco chegar ao próximo lugar (ex.: outro campo) antes de decidir.
    const later = () => setTimeout(update, 0);
    doc.addEventListener("focusin", update);
    doc.addEventListener("focusout", later);
    doc.addEventListener("selectionchange", update);
    doc.addEventListener("input", update);
    return () => {
      doc.removeEventListener("focusin", update);
      doc.removeEventListener("focusout", later);
      doc.removeEventListener("selectionchange", update);
      doc.removeEventListener("input", update);
    };
  }, [doc]);

  if (!el || !el.isConnected) return null;
  const win = doc.defaultView;
  const k = scale ? 1 / scale : 1;
  const style = win.getComputedStyle(el);
  const alreadyBold = Number(style.fontWeight) >= 600; // título, destaque: negrito já é o padrão
  const block = style.display !== "inline"; // alinhamento só faz sentido em texto de bloco
  const align = el.getAttribute("data-align");
  const state = (cmd) => { try { return doc.queryCommandState(cmd); } catch { return false; } };

  // Mouse: age no mousedown (sem tirar o foco do texto). Teclado (Enter/Espaço, click sem
  // detail): devolve o foco ao texto antes de agir; a seleção dele continua guardada.
  const run = (action) => ({
    onMouseDown: (e) => { e.preventDefault(); action(); win.requestAnimationFrame(() => setTick((t) => t + 1)); },
    onClick: (e) => {
      if (e.detail !== 0) return;
      el.focus({ preventScroll: true });
      action();
      win.requestAnimationFrame(() => setTick((t) => t + 1));
    },
  });
  const format = (cmd) => {
    selectionIn(doc, el);
    doc.execCommand("styleWithCSS", false, false);
    doc.execCommand(cmd); // dispara "input": o CanvasEditing grava
  };
  const color = (key) => {
    const selection = selectionIn(doc, el);
    if (key) {
      doc.execCommand("styleWithCSS", false, false);
      doc.execCommand("foreColor", false, SENTINELS[key]);
      applyColorSpans(el);
    } else {
      // Sem cor: tira a cor dos trechos coloridos que a seleção toca.
      const range = selection.getRangeAt(0);
      el.querySelectorAll(COLOR_SPANS).forEach((span) => { if (range.intersectsNode(span)) span.replaceWith(...span.childNodes); });
    }
    el.normalize();
    changed(el);
    setColorsOpen(false);
  };
  const setAlign = (key) => {
    if (align === key) el.removeAttribute("data-align"); // clicar de novo volta ao padrão do bloco
    else el.setAttribute("data-align", key);
    changed(el);
  };

  // Acima do texto; se não couber (topo da tela), abaixo.
  const rect = el.getBoundingClientRect();
  const barHeight = 44 * k;
  const above = rect.top - barHeight - 8 * k;
  const top = (above > 8 * k ? above : rect.bottom + 8 * k) + win.scrollY;
  const left = Math.max(8 * k, Math.min(rect.left, win.innerWidth - 330 * k)) + win.scrollX;
  const keep = (e) => e.preventDefault(); // clicar na barra não tira o foco do texto

  return (
    <div className="eo-toolbar eo-text-toolbar" role="toolbar" aria-label="Formatação do texto" onMouseDown={keep}
      style={{ top: `${top}px`, left: `${left}px`, transform: `scale(${k})`, transformOrigin: "0 0" }}>
      <button type="button" className="eo-btn eo-format" aria-label="Negrito (Ctrl+B)" title={alreadyBold ? "Este texto já é em negrito" : "Negrito (Ctrl+B)"}
        aria-pressed={!alreadyBold && state("bold")} disabled={alreadyBold} {...run(() => format("bold"))}>
        <strong>B</strong>
      </button>
      <button type="button" className="eo-btn eo-format" aria-label="Itálico (Ctrl+I)" title="Itálico (Ctrl+I)"
        aria-pressed={state("italic")} {...run(() => format("italic"))}>
        <em>I</em>
      </button>
      <span className="eo-colors">
        <button type="button" className="eo-btn eo-format" aria-label="Cor do texto" title="Cor do texto"
          aria-expanded={colorsOpen} {...run(() => setColorsOpen((o) => !o))}>
          <span className="eo-color-a">A</span>
        </button>
        {colorsOpen && (
          <span className="eo-color-menu" role="group" aria-label="Cores">
            {COLOR_KEYS.map((key) => (
              <button key={key} type="button" className={`eo-swatch tx-c-${key}`} aria-label={labels.colors?.[key] || key}
                title={labels.colors?.[key] || key} {...run(() => color(key))}>A</button>
            ))}
            <button type="button" className="eo-swatch eo-swatch-none" aria-label="Sem cor" title="Sem cor"
              {...run(() => color(null))}>⌀</button>
          </span>
        )}
      </span>
      <span className="eo-sep" aria-hidden="true" />
      {ALIGN_KEYS.map((key) => (
        <button key={key} type="button" className="eo-btn" aria-label={`Alinhar: ${labels.aligns?.[key] || key}`}
          title={block ? `Alinhar: ${labels.aligns?.[key] || key}${align === key ? " (clique de novo para voltar ao padrão)" : ""}` : "Este texto fica na mesma linha de um ícone: sem alinhamento próprio"}
          aria-pressed={align === key} disabled={!block} {...run(() => setAlign(key))}>
          <Glyph d={ALIGN_ICONS[key]} />
        </button>
      ))}
    </div>
  );
}
