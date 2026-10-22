// Controles desenhados SOBRE a página, dentro da moldura (iframe): a barra do bloco selecionado
// (mover, duplicar, configurar, remover), o botão "Remover imagem" sobre as imagens do bloco
// selecionado, os botões "+" nas bordas do bloco selecionado ou sob
// o mouse e a barra de formatação do texto em edição (TextToolbar). Ficam num <div> próprio no fim do <body> da moldura (createPortal), com estilos do
// venda-editor.css, e não mexem no layout da página: as posições são calculadas a partir das seções.
//
// A moldura é desenhada em escala (ex.: 1280 px exibidos a 60%); os controles recebem a escala
// inversa para continuarem do tamanho normal na tela.
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BlockIcon } from "../ui/BlockIcon.jsx";
import { TextToolbar } from "./TextToolbar.jsx";

const ICONS = {
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  duplicate: "M9 9h11v11H9zM5 15H4V4h11v1",
  settings: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  remove: "M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
};

export function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ToolButton({ icon, label, onClick, disabled, danger }) {
  return (
    <button type="button" className={`eo-btn${danger ? " danger" : ""}`} aria-label={label} title={label}
      disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

export function CanvasOverlay({ doc, scale, canvas, selectedIndex }) {
  const [host, setHost] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverImage, setHoverImage] = useState(null); // imagem sob o mouse (o X de remover aparece nela)
  const [, setTick] = useState(0); // redesenha ao rolar / redimensionar (posições mudam)

  useLayoutEffect(() => {
    const win = doc.defaultView;
    const el = doc.createElement("div");
    el.className = "editor-overlay";
    doc.body.appendChild(el);
    setHost(el);

    let frame = 0;
    const update = () => { win.cancelAnimationFrame(frame); frame = win.requestAnimationFrame(() => setTick((t) => t + 1)); };
    // Bloco sob o mouse. Sobre os próprios controles, mantém o atual (senão o "+" sumiria ao chegar nele).
    const onOver = (e) => {
      if (e.target.closest?.(".editor-overlay")) return;
      const section = e.target.closest?.("[data-block]");
      setHoverIndex(section ? Number(section.dataset.block) : null);
      setHoverImage(e.target.closest?.("img[data-image-field]") || null);
    };
    const onLeave = () => { setHoverIndex(null); setHoverImage(null); };
    win.addEventListener("scroll", update, { passive: true });
    win.addEventListener("resize", update);
    doc.addEventListener("mouseover", onOver);
    doc.documentElement.addEventListener("mouseleave", onLeave);
    const observer = new win.ResizeObserver(update); // textos digitados mudam a altura das seções
    observer.observe(doc.body);
    return () => {
      win.cancelAnimationFrame(frame);
      win.removeEventListener("scroll", update);
      win.removeEventListener("resize", update);
      doc.removeEventListener("mouseover", onOver);
      doc.documentElement.removeEventListener("mouseleave", onLeave);
      observer.disconnect();
      el.remove();
    };
  }, [doc]);

  if (!host) return null;
  const win = doc.defaultView;
  const k = scale ? 1 / scale : 1;
  const { sections, schema } = canvas;
  const full = sections.length >= schema.maxBlocks;
  const rectOf = (i) => doc.querySelector(`[data-block="${i}"]`)?.getBoundingClientRect();
  const viewport = win.innerHeight;

  // Botões "+": bordas de cima e de baixo dos blocos em foco (o de baixo de um é o de cima do próximo).
  const inserts = new Map(); // posição de inserção -> { x, y }
  // canvas.single (bloco salvo): sem "+" nem mover/duplicar/remover blocos.
  for (const i of canvas.single ? [] : new Set([selectedIndex, hoverIndex])) {
    if (i === null || i === undefined) continue;
    const r = rectOf(i);
    if (!r) continue;
    const x = r.left + r.width / 2 + win.scrollX;
    if (!inserts.has(i)) inserts.set(i, { x, y: r.top + win.scrollY });
    inserts.set(i + 1, { x, y: r.bottom + win.scrollY });
  }

  // Barra do bloco selecionado: canto superior direito da seção, presa à área visível enquanto a
  // seção estiver na tela (em seções altas ela acompanha a rolagem).
  let toolbar = null;
  const selRect = selectedIndex !== null && selectedIndex !== undefined ? rectOf(selectedIndex) : null;
  if (selRect && selRect.bottom > 0 && selRect.top < viewport) {
    const i = selectedIndex;
    const block = sections[i];
    const label = block ? schema.blocks[block.type]?.label : "";
    const barHeight = 44 * k;
    const top = Math.min(Math.max(selRect.top + 10 * k, 10 * k), Math.max(selRect.top, selRect.bottom - barHeight - 10 * k));
    const n = i + 1;
    // Com a janela flutuante aberta (à direita, por cima da página), a barra desvia para a esquerda dela.
    const right = Math.min(selRect.right, win.innerWidth - (canvas.panelInset || 0) * k);
    toolbar = block && (
      <div className="eo-toolbar" role="toolbar" aria-label={`Bloco ${n}: ${label}`}
        style={{ top: `${top + win.scrollY}px`, left: `${right - 10 * k + win.scrollX}px`, transform: `translateX(-100%) scale(${k})` }}>
        <span className="eo-label"><BlockIcon type={block.type} /> {label}</span>
        {!canvas.single && <>
          <ToolButton icon="up" label={`Mover bloco ${n} (${label}) para cima`} disabled={i === 0} onClick={() => canvas.move(i, -1)} />
          <ToolButton icon="down" label={`Mover bloco ${n} (${label}) para baixo`} disabled={i === sections.length - 1} onClick={() => canvas.move(i, 1)} />
          <ToolButton icon="duplicate" label={`Duplicar bloco ${n} (${label})`} disabled={full} onClick={() => canvas.duplicate(i)} />
        </>}
        <ToolButton icon="settings" label={`Configurar bloco ${n} (${label}): imagens, ícones e itens`} onClick={() => canvas.configure(i)} />
        {!canvas.single && <ToolButton icon="remove" label={`Remover bloco ${n} (${label})`} danger onClick={() => canvas.remove(i)} />}
      </div>
    );
  }

  // X de "Remover imagem" no canto das imagens visíveis do bloco selecionado (as do carrossel fora
  // da tela ficam sem botão; a galeria remove pelo × do item). Só aparece com o mouse sobre a
  // imagem (ou sobre o próprio X), ao chegar pelo Tab ou, em tela de toque, sempre.
  const imageButtons = [];
  if (selRect && sections[selectedIndex]) {
    doc.querySelectorAll(`[data-block="${selectedIndex}"] img[data-image-field]`).forEach((img) => {
      const field = img.dataset.imageField;
      const r = img.getBoundingClientRect();
      const visible = r.width > 24 && r.height > 24 && r.bottom > 0 && r.top < viewport
        && r.left >= selRect.left - 1 && r.right <= selRect.right + 1;
      if (!visible || !canvas.canRemoveImage(selectedIndex, field)) return;
      imageButtons.push(
        <button key={field} type="button" className={`eo-image-remove${img === hoverImage ? " is-shown" : ""}`} title="Remover imagem (o espaço fica vazio)"
          aria-label={`Remover imagem do bloco ${selectedIndex + 1}`}
          style={{ top: `${r.top + win.scrollY + 8 * k}px`, left: `${r.right + win.scrollX - 8 * k}px`, transform: `translateX(-100%) scale(${k})` }}
          onClick={() => canvas.removeImage(selectedIndex, field)}>
          <Icon name="close" />
        </button>,
      );
    });
  }

  // Página sem blocos: um botão grande no lugar do conteúdo.
  let first = null;
  if (!sections.length) {
    const main = doc.querySelector("main")?.getBoundingClientRect();
    if (main) {
      first = (
        <button type="button" className="eo-first" style={{ top: `${main.top + win.scrollY + 24 * k}px`, left: `${main.left + main.width / 2}px`, transform: `translateX(-50%) scale(${k})` }}
          onClick={(e) => canvas.insert(0, e.currentTarget.getBoundingClientRect())}>
          <Icon name="plus" /> Adicionar o primeiro bloco
        </button>
      );
    }
  }

  return createPortal(
    <>
      {[...inserts].map(([position, { x, y }]) => (
        <button key={position} type="button" className="eo-insert" disabled={full}
          aria-label={full ? `Limite de ${schema.maxBlocks} blocos atingido` : `Inserir bloco na posição ${position + 1}`}
          title={full ? `Limite de ${schema.maxBlocks} blocos` : "Inserir bloco aqui"}
          style={{ top: `${y}px`, left: `${x}px`, transform: `translate(-50%, -50%) scale(${k})` }}
          onClick={(e) => canvas.insert(position, e.currentTarget.getBoundingClientRect())}>
          <Icon name="plus" />
        </button>
      ))}
      {imageButtons}
      {toolbar}
      {first}
      <TextToolbar doc={doc} scale={scale} labels={{ colors: schema.textColors, aligns: schema.textAligns }} />
    </>,
    host,
  );
}
