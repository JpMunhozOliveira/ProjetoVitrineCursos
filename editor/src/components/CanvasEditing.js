// Edição direta na pré-visualização: os textos marcados pelo servidor com data-field (ver
// server/sales/render.js, modo "live") viram editáveis dentro da moldura (iframe).
//
// Cada letra digitada vai para o MESMO estado do formulário (dispatch "set"), então desfazer,
// "não salvo" e a validação funcionam igual. A pré-visualização NÃO é redesenhada enquanto se
// digita na página (o texto já está na tela): isso manteria o cursor pulando a cada pausa.
//
// Os ouvintes ficam no document da moldura e chamam sempre a versão atual das funções do editor
// através de api.current (a moldura é recriada a cada atualização; o editor, não).
import { resolveField, normalizeText } from "../state/fields.js";
import { serialize } from "../state/richtext.js";

const FIELD = "[data-field]";

// Onde o campo está: { block: índice do bloco, field: caminho dentro dele }.
function locate(el) {
  const section = el?.closest?.("[data-block]");
  if (!section || !el.matches(FIELD)) return null;
  return { block: Number(section.dataset.block), field: el.dataset.field };
}

function resolve(el, api) {
  const at = locate(el);
  return at && resolveField(api.schema, api.sections, at.block, at.field);
}

// Campo de texto em edição na moldura (ou null). Só conta se a moldura tem o foco de fato.
export function activeField(doc) {
  const el = doc?.activeElement;
  return doc?.hasFocus() && el?.matches?.(FIELD) ? locate(el) : null;
}

// Coloca o cursor no fim do campo indicado (depois que a moldura foi redesenhada).
export function focusField(doc, at) {
  if (!doc || !at) return false;
  const el = doc.querySelector(`[data-block="${at.block}"] [data-field="${CSS.escape(at.field)}"]`);
  if (!el) return false;
  // Se o foco está no painel (ex.: acabou de escolher um bloco no menu), focar só o elemento não
  // basta: a moldura precisa receber o foco da janela primeiro.
  doc.defaultView.frameElement?.focus({ preventScroll: true });
  el.focus({ preventScroll: true });
  const range = doc.createRange();
  range.selectNodeContents(el);
  // Texto padrão (data-fallback, ex.: "Site" num link novo): fica todo selecionado, e digitar o
  // substitui. Nos outros campos, o cursor vai para o fim.
  if (!el.hasAttribute("data-fallback")) range.collapse(false);
  const selection = doc.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

// Durante uma atualização pendente, os índices da moldura podem estar velhos (ex.: bloco movido):
// os campos ficam só leitura até a versão nova chegar, para nada ser gravado no bloco errado.
export function lockFields(doc) {
  doc?.querySelectorAll(FIELD).forEach((el) => el.setAttribute("contenteditable", "false"));
}

function makeEditable(el, api) {
  const target = resolve(el, api);
  if (!target) return;
  // Editável com formatação (negrito, itálico, cor pela barra: TextToolbar). O que é colado ou
  // solto entra sempre como texto puro (ouvintes de paste/drop abaixo).
  el.contentEditable = "true";
  el.setAttribute("role", "textbox");
  el.setAttribute("aria-label", target.field.label);
  if (target.field.type === "textarea") el.setAttribute("aria-multiline", "true");
  el.spellcheck = true;
}

export function unlockFields(doc, api) {
  doc?.querySelectorAll(FIELD).forEach((el) => makeEditable(el, api));
}

export function attachCanvas(doc, apiRef) {
  const api = () => apiRef.current;
  unlockFields(doc, api());

  const fieldOf = (e) => e.target?.closest?.(FIELD);

  doc.addEventListener("beforeinput", (e) => {
    // Desfazer/refazer pelo menu do navegador: usa o histórico do editor (o do navegador não
    // conhece o estado da página e deixaria tela e dados diferentes).
    if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
      e.preventDefault();
      if (e.inputType === "historyUndo") api().undo(); else api().redo();
      return;
    }
    const el = fieldOf(e);
    const target = el && resolve(el, api());
    if (!target) return;
    const multiline = target.field.type === "textarea";
    // Formatação: só negrito e itálico pelo teclado (sublinhado, tachado etc. não existem na página).
    // Negrito num texto que já é negrito (título) viraria "não negrito", que não dá para guardar.
    if (e.inputType.startsWith("format")) {
      const bold = e.inputType === "formatBold";
      if (!(bold || e.inputType === "formatItalic") || (bold && Number(doc.defaultView.getComputedStyle(el).fontWeight) >= 600)) {
        e.preventDefault();
      }
      return;
    }
    if (!multiline && (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak")) {
      e.preventDefault(); // título, botão etc.: uma linha só
      return;
    }
    // Limite de caracteres do esquema (o servidor recusaria ao salvar): entra só o que cabe.
    const added = e.data ?? e.dataTransfer?.getData("text/plain") ?? (e.inputType.startsWith("insert") ? "\n" : "");
    if (added) {
      const current = normalizeText(el.innerText, multiline).length;
      const selected = doc.getSelection()?.toString().length || 0;
      const room = target.field.max - (current - selected);
      if (added.length > room) {
        e.preventDefault();
        if (room > 0 && added.length > 1) doc.execCommand("insertText", false, added.slice(0, room)); // colar texto longo
      }
    }
  });

  doc.addEventListener("input", (e) => {
    const el = fieldOf(e);
    const target = el && resolve(el, api());
    if (!target) return;
    // Digitou: o texto de exemplo e a marca de "texto padrão" deixam de valer.
    el.removeAttribute("data-empty");
    el.removeAttribute("data-fallback");
    api().edit(target.path, serialize(el, target.field.type === "textarea"));
  });

  // Colar e soltar: só o texto (formatação de fora, como de um site ou do Word, não entra).
  doc.addEventListener("paste", (e) => {
    if (!fieldOf(e)) return;
    e.preventDefault();
    doc.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  });
  doc.addEventListener("drop", (e) => {
    if (!fieldOf(e)) return;
    e.preventDefault();
    const text = e.dataTransfer?.getData("text/plain");
    const at = doc.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (at) { const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(at); }
    if (text) doc.execCommand("insertText", false, text);
  });

  doc.addEventListener("keydown", (e) => {
    // As teclas digitadas na moldura não chegam à janela do painel: repassa os atalhos.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) { e.preventDefault(); api().undo(); }
      else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); api().redo(); }
      else if (key === "s") { e.preventDefault(); api().save(); }
      return;
    }
    if (e.key === "Escape") {
      const el = fieldOf(e);
      if (el) el.blur();       // 1º Esc: sai do texto (o bloco continua selecionado)
      else api().deselect();   // 2º Esc: tira a seleção
    }
  });

  // FAQ: no editor as perguntas ficam sempre abertas (a resposta é editável). Clicar no texto da
  // pergunta só posiciona o cursor; e o navegador ainda fecha o <details> com Espaço/Enter digitados
  // dentro do <summary> — nesse caso ele é reaberto na hora.
  doc.addEventListener("click", (e) => {
    if (fieldOf(e) && e.target.closest("summary")) e.preventDefault();
  }, true);
  // Clicar num ícone da página abre a lista de ícones logo abaixo dele (o servidor marca cada
  // ícone editável com data-icon-field = caminho do campo dentro do bloco).
  doc.addEventListener("click", (e) => {
    const icon = e.target.closest?.("[data-icon-field]");
    const section = icon?.closest("[data-block]");
    if (!section) return;
    api().pickIcon(Number(section.dataset.block), icon.dataset.iconField, icon.getBoundingClientRect());
  });
  // Imagens: clicar numa imagem (ou no espaço "Adicionar imagem") abre a biblioteca de imagens.
  // data-image-field = campo da imagem; data-image-add = lista onde entra uma imagem nova (galeria).
  doc.addEventListener("click", (e) => {
    const image = e.target.closest?.("[data-image-field], [data-image-add]");
    const section = image?.closest("[data-block]");
    if (!section) return;
    const block = Number(section.dataset.block);
    if (image.dataset.imageAdd) api().addImage(block, image.dataset.imageAdd);
    else api().pickImage(block, image.dataset.imageField);
  });
  // Itens das listas: "+ Adicionar …" no fim da lista (data-item-add = a lista) e × em cada item
  // (data-item-remove = o item, ex.: "items.3").
  doc.addEventListener("click", (e) => {
    const button = e.target.closest?.("[data-item-add], [data-item-remove]");
    const section = button?.closest("[data-block]");
    if (!section) return;
    e.preventDefault(); // dentro de <summary>/<details> o clique não abre nem fecha nada
    const block = Number(section.dataset.block);
    if (button.dataset.itemAdd) api().addItem(block, button.dataset.itemAdd);
    else api().removeItem(block, button.dataset.itemRemove);
  });
  doc.addEventListener("toggle", (e) => {
    if (e.target.matches?.("details") && !e.target.open) e.target.open = true;
  }, true);

  doc.addEventListener("focusin", (e) => {
    const at = locate(fieldOf(e));
    if (at) api().select(at.block);
  });

  // Saiu da edição de texto (e não foi para outro campo da página): hora de redesenhar, para
  // ajustar parágrafos, textos padrão e blocos que passam a aparecer ou sumir.
  // Foco indo para a barra de formatação (teclado) não conta como sair do texto.
  doc.addEventListener("focusout", (e) => {
    if (!fieldOf(e) || e.relatedTarget?.closest?.(".eo-text-toolbar")) return;
    setTimeout(() => {
      if (!activeField(doc) && !doc.activeElement?.closest?.(".eo-text-toolbar")) api().leave();
    }, 0);
  });
}
