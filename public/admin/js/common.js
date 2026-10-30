/* Funções compartilhadas pelas páginas do painel (window.Admin). */
(function () {
  "use strict";
  var csrf = null;

  var STATUS = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };

  // Chama a API administrativa. Em requisições que alteram dados, envia o token CSRF da sessão.
  // opts.file: envia um arquivo como corpo bruto (upload de imagem), em vez de JSON.
  // opts.text: devolve a resposta como texto (ex.: HTML da pré-visualização), em vez de JSON.
  async function api(path, opts) {
    opts = opts || {};
    var method = opts.method || "GET", headers = { Accept: "application/json" }, body;
    if (opts.file) {
      headers["Content-Type"] = opts.file.type;
      headers["X-File-Name"] = encodeURIComponent(opts.file.name); // só para exibição no painel
      body = opts.file;
    } else if (opts.body) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
    var res = await fetch("/api/admin" + path, {
      method: method, headers: headers, credentials: "same-origin", body: body
    });
    if (opts.text && res.ok) return res.text();
    var payload = null;
    try { payload = await res.json(); } catch (e) { /* 204 sem corpo */ }
    if (!res.ok) {
      var err = new Error((payload && payload.error) || "Erro inesperado.");
      err.status = res.status; throw err;
    }
    return payload && payload.data;
  }

  // Exige sessão do painel: sem ela, volta ao login. Também preenche o e-mail e liga o botão "Sair".
  async function requireSession() {
    var who = null;
    try { who = await api("/auth/me"); } catch (err) { if (err.status !== 401) throw err; }
    if (!who || who.via !== "session") {
      location.replace("login.html");
      return new Promise(function () {}); // interrompe a página enquanto o navegador redireciona
    }
    csrf = who.csrfToken;
    document.getElementById("who").textContent = who.email;
    document.getElementById("logout").addEventListener("click", async function () {
      var ok = await confirmAction({
        title: "Sair do painel?",
        text: Admin.hasUnsavedChanges()
          ? "Há alterações não salvas nesta página. Se sair agora, elas serão perdidas."
          : "Para voltar, será preciso entrar de novo com e-mail e senha.",
        action: "Sair",
        danger: Admin.hasUnsavedChanges()
      });
      if (!ok) return;
      try { await api("/auth/logout", { method: "POST" }); } catch (e) { /* sai mesmo assim */ }
      Admin.leaving = true; // já confirmado: a página não pergunta de novo sobre alterações não salvas
      location.replace("login.html");
    });
    return who;
  }

  // Preço chega da API em centavos (inteiro); a conversão para reais é só na exibição.
  function formatPrice(cents) {
    if (cents === null || cents === undefined) return "—";
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function showMessage(el, text, kind) {
    el.textContent = text || "";
    el.classList.toggle("error", kind === "error");
    el.classList.toggle("success", kind === "success");
  }

  // Confirmação dentro da página com <dialog> nativo (foco, tecla Esc e fundo bloqueado já vêm prontos).
  // Uso: if (await Admin.confirm({ title, text, action: "Excluir", danger: true, cancel: "Manter" })) { ... }
  var dialog = null;
  function confirmAction(opts) {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "confirm";
      dialog.setAttribute("aria-labelledby", "confirm-title");
      dialog.innerHTML = '<form method="dialog"><h2 id="confirm-title"></h2><p class="confirm-text"></p>' +
        '<div class="buttons"><button class="btn btn-outline" value="cancel">Cancelar</button>' +
        '<button class="btn confirm-ok" value="ok"></button></div></form>';
      document.body.append(dialog);
    }
    dialog.querySelector("h2").textContent = opts.title;
    dialog.querySelector(".confirm-text").textContent = opts.text;
    var ok = dialog.querySelector(".confirm-ok");
    ok.textContent = opts.action;
    dialog.querySelector('[value="cancel"]').textContent = opts.cancel || "Cancelar";
    ok.classList.toggle("btn-danger", !!opts.danger);
    dialog.returnValue = "";
    dialog.showModal();
    dialog.querySelector('[value="cancel"]').focus(); // ação destrutiva nunca é o padrão
    return new Promise(function (resolve) {
      dialog.addEventListener("close", function () { resolve(dialog.returnValue === "ok"); }, { once: true });
    });
  }

  // Visualizador: mostra a imagem inteira (sem cortes) num <dialog>. Fecha com o botão, Esc ou
  // clique fora da imagem. Uso: Admin.viewImage({ url, alt, title, width, height, onSaveAlt })
  // onSaveAlt(texto) (opcional, aba Imagens): mostra o texto alternativo num campo editável com
  // "Salvar"; deve devolver uma promessa com o texto gravado. Sem ele, o texto só aparece.
  var viewer = null, viewerState = null;
  var ALT_MAX = 300;
  function viewImage(image) {
    if (!viewer) {
      viewer = document.createElement("dialog");
      viewer.className = "viewer";
      viewer.setAttribute("aria-labelledby", "viewer-title");
      // Esqueleto fixo; os dados entram só por textContent/value.
      viewer.innerHTML = '<div class="viewer-head"><h2 id="viewer-title"></h2>' +
        '<button class="btn btn-sm btn-outline viewer-close" type="button">Fechar</button></div>' +
        '<img alt=""><p class="viewer-info muted small"></p>' +
        '<form class="viewer-edit" hidden>' +
        '<label for="viewer-alt">Texto alternativo</label>' +
        '<textarea id="viewer-alt" rows="2" maxlength="' + ALT_MAX + '" aria-describedby="viewer-alt-hint viewer-alt-count"></textarea>' +
        '<div class="viewer-edit-foot"><p id="viewer-alt-hint" class="hint">Descreva o que a imagem mostra, para quem usa leitor de tela. <span id="viewer-alt-count"></span></p>' +
        '<button class="btn btn-sm" type="submit">Salvar</button></div>' +
        '<p class="msg viewer-msg" role="status" aria-live="polite"></p></form>';
      var form = viewer.querySelector(".viewer-edit"), area = form.querySelector("textarea");
      var count = function () { viewer.querySelector("#viewer-alt-count").textContent = area.value.length + "/" + ALT_MAX; };
      area.addEventListener("input", function () { count(); showMessage(viewer.querySelector(".viewer-msg"), ""); });
      // Enter salva (texto alternativo é uma frase só, sem quebra de linha).
      area.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); form.requestSubmit(); } });
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var state = viewerState, btn = form.querySelector("button"), msg = viewer.querySelector(".viewer-msg");
        if (!state || !state.onSaveAlt) return;
        btn.disabled = true;
        try {
          state.saved = (await state.onSaveAlt(area.value.trim() || null)) || "";
          area.value = state.saved;
          count();
          viewer.querySelector("img").alt = state.saved;
          showMessage(msg, "Texto alternativo salvo.", "success");
        } catch (err) {
          showMessage(msg, err.message, "error");
        } finally {
          btn.disabled = false;
        }
      });
      viewer.querySelector(".viewer-close").addEventListener("click", closeViewer);
      // O clique no fundo escurecido chega ao próprio <dialog> (e não a um filho dele).
      viewer.addEventListener("click", function (e) { if (e.target === viewer) closeViewer(); });
      viewer.addEventListener("cancel", function (e) { e.preventDefault(); closeViewer(); }); // tecla Esc
      document.body.append(viewer);
    }
    var editable = typeof image.onSaveAlt === "function";
    viewerState = { onSaveAlt: editable ? image.onSaveAlt : null, saved: image.alt || "" };
    var img = viewer.querySelector("img");
    img.src = image.url;
    img.alt = image.alt || "";
    img.width = image.width; img.height = image.height;
    viewer.querySelector("h2").textContent = image.title || "Imagem";
    viewer.querySelector(".viewer-info").textContent = image.width + "×" + image.height + " px" +
      (editable ? "" : image.alt ? " · " + image.alt : " · sem texto alternativo");
    var form = viewer.querySelector(".viewer-edit");
    form.hidden = !editable;
    form.querySelector("textarea").value = image.alt || "";
    viewer.querySelector("#viewer-alt-count").textContent = (image.alt || "").length + "/" + ALT_MAX;
    showMessage(viewer.querySelector(".viewer-msg"), "");
    viewer.showModal();
    if (editable) form.querySelector("textarea").focus(); // pronto para digitar
  }

  // Fecha o visualizador; com texto alternativo alterado e não salvo, pergunta antes.
  async function closeViewer() {
    var area = viewer.querySelector("textarea");
    var dirty = viewerState && viewerState.onSaveAlt && area.value.trim() !== viewerState.saved;
    if (dirty && !(await confirmAction({
      title: "Descartar a alteração?",
      text: "O texto alternativo que você escreveu ainda não foi salvo.",
      action: "Descartar", cancel: "Continuar editando", danger: true
    }))) return;
    viewer.close();
  }

  // Seletor de imagens da biblioteca (com envio de imagem nova no próprio diálogo).
  // Uso: var media = await Admin.pickImage({ currentId, hint }); // null = fechou sem escolher
  // hint: tamanho recomendado para o lugar da imagem (ex.: "Tamanho recomendado: 1200 × 675 px").
  var picker = null, pickerResolve = null;
  function pickImage(opts) {
    opts = opts || {};
    if (!picker) {
      picker = document.createElement("dialog");
      picker.className = "picker";
      picker.setAttribute("aria-labelledby", "picker-title");
      picker.innerHTML = '<div class="picker-head"><h2 id="picker-title">Escolher imagem</h2><div class="row-actions">' +
        '<label class="btn btn-sm file-btn">Enviar nova<input type="file" accept="image/png,image/jpeg,image/webp"></label>' +
        '<button class="btn btn-sm btn-outline picker-close" type="button">Fechar</button></div></div>' +
        '<p class="hint picker-hint"></p><p class="msg picker-msg" role="status" aria-live="polite"></p><div class="media-grid"></div>';
      document.body.append(picker);
      picker.querySelector(".picker-close").addEventListener("click", function () { picker.close(); });
      picker.addEventListener("close", function () { if (pickerResolve) { pickerResolve(null); pickerResolve = null; } });
      picker.querySelector("input[type=file]").addEventListener("change", async function () {
        var file = this.files[0];
        this.value = "";
        if (!file) return;
        var msg = picker.querySelector(".picker-msg");
        showMessage(msg, "Enviando “" + file.name + "”…");
        try { choose(await uploadImage(file)); } catch (err) { showMessage(msg, err.message, "error"); }
      });
    }
    function choose(media) {
      var resolve = pickerResolve;
      pickerResolve = null;
      picker.close();
      resolve(media);
    }

    var grid = picker.querySelector(".media-grid"), msg = picker.querySelector(".picker-msg");
    var hint = picker.querySelector(".picker-hint");
    hint.textContent = opts.hint || "";
    hint.hidden = !opts.hint;
    grid.replaceChildren();
    showMessage(msg, "Carregando…");
    picker.showModal();
    api("/media").then(function (items) {
      showMessage(msg, items.length ? "" : "A biblioteca está vazia. Use “Enviar nova”.");
      items.forEach(function (m) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "media-option";
        if (opts.currentId === m.id) b.setAttribute("aria-current", "true");
        var img = document.createElement("img");
        img.src = m.url; img.alt = ""; img.loading = "lazy"; img.width = m.width; img.height = m.height;
        var name = document.createElement("span");
        name.textContent = m.original_name || "Imagem sem nome";
        b.append(img, name);
        b.setAttribute("aria-label", "Usar " + name.textContent + (m.alt_text ? " — " + m.alt_text : ""));
        b.addEventListener("click", function () { choose(m); });
        grid.append(b);
      });
    }).catch(function (err) { showMessage(msg, err.message, "error"); });

    return new Promise(function (resolve) { pickerResolve = resolve; });
  }

  // Upload de imagem com conferência prévia no navegador (só para avisar rápido;
  // quem decide de verdade é o servidor, que confere a assinatura do arquivo).
  var IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  function uploadImage(file) {
    if (IMAGE_TYPES.indexOf(file.type) < 0) {
      return Promise.reject(new Error("“" + file.name + "” não é PNG, JPEG ou WebP."));
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return Promise.reject(new Error("“" + file.name + "” tem mais de 5 MB."));
    }
    return api("/media", { method: "POST", file: file });
  }

  function formatBytes(bytes) {
    return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + " KB"
      : (bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " MB";
  }

  /* Campo de imagem de formulário (capa do produto, logo da empresa).
     A imagem é enviada para a biblioteca na hora (gera um registro em /media), mas só vale quando o
     formulário é salvo. Se você desistir, ela fica na biblioteca e pode ser excluída lá.
     Cada campo usa elementos com o mesmo prefixo: <prefixo>-img, -zoom, -empty, -file, -pick,
     -remove, -alt, -alt-field e -msg. onChange: chamado quando a imagem muda (marca "não salvo").
     texts.hint: tamanho recomendado, repetido na janela de escolher imagem.
     Uso: var logo = Admin.imageField("logo", { title, removed, apply, hint }, function () { dirty = true; }); */
  function imageField(prefix, texts, onChange) {
    var el = function (part) { return document.getElementById(prefix + "-" + part); };
    var field = { image: null }; // { id, url, alt_text, width, height } ou null

    field.show = function (image) {
      field.image = image;
      var img = el("img");
      el("zoom").hidden = !image;
      el("empty").hidden = !!image;
      if (image) {
        img.src = image.url;
        img.width = image.width; img.height = image.height; // reserva o espaço antes de carregar
      } else {
        img.removeAttribute("src");
      }
      el("remove").hidden = !image;
      el("alt-field").hidden = !image;
      el("alt").value = image ? image.alt_text || "" : "";
    };

    function choose(image, text) {
      field.show(image);
      if (onChange) onChange(image);
      showMessage(el("msg"), text, "success");
    }

    el("file").addEventListener("change", async function () {
      var file = this.files[0];
      this.value = ""; // permite escolher o mesmo arquivo de novo depois
      if (!file) return;
      showMessage(el("msg"), "Enviando “" + file.name + "”…");
      try {
        choose(await uploadImage(file), "Imagem enviada. " + texts.apply);
        el("alt").focus(); // próximo passo natural: descrever a imagem
      } catch (err) {
        showMessage(el("msg"), err.message, "error");
      }
    });

    el("zoom").addEventListener("click", function () {
      if (!field.image) return;
      viewImage({
        url: field.image.url, alt: el("alt").value.trim(), title: texts.title,
        width: field.image.width, height: field.image.height
      });
    });

    el("remove").addEventListener("click", function () {
      choose(null, texts.removed + " Clique em Salvar para aplicar (a imagem continua na biblioteca).");
    });

    // Seletor de imagens da biblioteca (pickImage, acima).
    el("pick").addEventListener("click", async function () {
      var m = await pickImage({ currentId: field.image && field.image.id, hint: texts.hint });
      if (m) choose(m, "Imagem escolhida. " + texts.apply);
    });

    // O texto alternativo pertence à imagem (fica na biblioteca); é gravado ao salvar o formulário.
    field.saveAlt = async function () {
      if (!field.image) return;
      var alt = el("alt").value.trim();
      if (alt === (field.image.alt_text || "")) return;
      var updated = await api("/media/" + encodeURIComponent(field.image.id), { method: "PATCH", body: { alt_text: alt || null } });
      field.image.alt_text = updated.alt_text;
    };

    field.clearMessage = function () { showMessage(el("msg"), ""); };
    return field;
  }

  // Mensagem que sobrevive a um redirecionamento (ex.: excluir na edição e voltar para a lista).
  function setFlash(text) { try { sessionStorage.setItem("admin-flash", text); } catch (e) {} }
  function takeFlash() {
    try {
      var text = sessionStorage.getItem("admin-flash");
      sessionStorage.removeItem("admin-flash");
      return text;
    } catch (e) { return null; }
  }

  // Links internos (abas, "Voltar", "← Produtos"...) com alterações não salvas: pergunta antes de sair.
  // O aviso nativo do navegador (beforeunload) fica só para fechar/recarregar a aba, porque ele nem
  // sempre aparece e não permite texto próprio.
  document.addEventListener("click", async function (e) {
    var link = e.target.closest && e.target.closest("a[href]");
    if (!link || !Admin.hasUnsavedChanges()) return;
    // Ctrl/Cmd/Shift+clique, botão do meio e target="_blank" abrem outra aba: esta página continua aqui.
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || link.target === "_blank") return;
    e.preventDefault();
    var ok = await confirmAction({
      title: "Sair sem salvar?",
      text: "Há alterações nesta página que ainda não foram salvas. Se sair agora, elas serão perdidas.",
      action: "Sair sem salvar",
      cancel: "Continuar editando",
      danger: true
    });
    if (!ok) return; // "Cancelar" = continuar editando
    Admin.leaving = true;
    location.href = link.href;
  });

  // Ícones dos tipos de bloco: aba Blocos salvos e editor da página de vendas
  // (editor/src/ui/BlockIcon.jsx lê daqui). Tipo sem ícone próprio usa o genérico.
  var BLOCK_ICONS = {
    hero: "M3 4h18v10H3zM7 18h10M9 21h6",                                  // tela com destaque
    benefits: "M3 5h8v14H3zM13 5h8v14h-8zM6 9h2M16 9h2",                   // dois cartões
    topics: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",           // grade
    gallery: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01",            // imagem
    checklist: "M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M4 19h16",         // lista ✓
    comparison: "M3 4h7v16H3zM14 4h7v16h-7zM10.5 12h3",                    // duas colunas
    author: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6", // pessoa
    audience: "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 7-5s7 2 7 5M17 4a3 3 0 0 1 0 6M19 15c2 .7 3 2.3 3 5", // pessoas
    highlight: "M3 11v2l13 5V6zM16 9a3 3 0 0 1 0 6M6 13l1 6h3l-1-5",       // megafone
    cta: "M3 8h18v8H3zM13 12h5M16 10l2 2-2 2",                            // faixa com seta
    testimonials: "M4 5h16v11H10l-5 4v-4H4zM8 9h8M8 12h5",                 // balão de fala
    faq: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01", // interrogação
    guarantee: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5", // escudo ✓
    offer: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",                              // etiqueta de preço
    social: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4", // compartilhar
    _fallback: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5"
  };
  function blockIcon(type, className) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg"), path = document.createElementNS(NS, "path");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className || "block-icon");
    path.setAttribute("d", BLOCK_ICONS[type] || BLOCK_ICONS._fallback);
    [["fill", "none"], ["stroke", "currentColor"], ["stroke-width", "1.8"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"]]
      .forEach(function (a) { path.setAttribute(a[0], a[1]); });
    svg.append(path);
    return svg;
  }

  // "Usada em X lugares": a lista (com links) abre num balão ao passar o mouse, focar ou tocar.
  // items: [{ label: "Capa de ", title, href }]; words: { prefix: "Usada em", one: "lugar", many: "lugares" }.
  function usagePopover(items, words) {
    var box = document.createElement("div");
    box.className = "usage-pop";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "usage-btn";
    btn.textContent = words.prefix + " " + items.length + " " + (items.length === 1 ? words.one : words.many);
    btn.setAttribute("aria-expanded", "false");
    var list = document.createElement("ul");
    list.className = "usage-list";
    items.forEach(function (u) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.href = u.href;
      a.textContent = u.title;
      li.append(u.label || "", a);
      list.append(li);
    });
    // Toque no celular (sem "hover"): o clique abre e fecha o balão.
    btn.addEventListener("click", function () {
      var open = !box.classList.contains("is-open");
      closePops(box);
      box.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
    box.append(btn, list);
    return box;
  }
  // Balões ("Usada em…" e o "i" de informação ao lado do título) abertos pelo toque fecham ao
  // tocar fora deles ou com Esc. No computador eles abrem só com o mouse em cima ou com o foco.
  function closePops(except) {
    document.querySelectorAll(".usage-pop.is-open, .info-pop.is-open").forEach(function (o) {
      if (o === except) return;
      o.classList.remove("is-open");
      o.querySelector("button").setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", function (e) {
    var pop = e.target.closest && e.target.closest(".usage-pop, .info-pop");
    closePops(pop);
    var info = e.target.closest && e.target.closest(".info-btn");
    if (info) {
      var open = !pop.classList.contains("is-open");
      pop.classList.toggle("is-open", open);
      info.setAttribute("aria-expanded", String(open));
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePops(null); });

  // Busca das listas (Imagens, Blocos salvos, Empresas): sem diferenciar maiúsculas nem acentos
  // ("tributaria" encontra "Tributária"); todas as palavras digitadas precisam aparecer.
  // text(item) devolve o texto pesquisável de cada item.
  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  function searchFilter(items, query, text) {
    var terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return items;
    return items.filter(function (item) {
      var haystack = normalize(text(item));
      return terms.every(function (t) { return haystack.indexOf(t) >= 0; });
    });
  }

  // Troca de empresa (Resumo e Produtos): "Todas" + uma pílula por empresa, com o ícone da aba
  // (ou o logo). Só aparece com 2 ou mais empresas. A escolha fica no endereço (?empresa=…), para
  // recarregar a página sem perder o filtro. Devolve uma função que diz a empresa escolhida ("" = todas).
  // opts.count(id) mostra um número ao lado do nome; opts.extra acrescenta opções no fim ({ value, label }).
  function brandSwitch(box, brands, onChange, opts) {
    opts = opts || {};
    var extra = opts.extra || [];
    var wanted = new URL(location.href).searchParams.get("empresa") || "";
    var valid = brands.some(function (b) { return b.id === wanted; }) || extra.some(function (x) { return x.value === wanted; });
    if (!valid) wanted = "";
    var chosen = wanted;

    function option(value, label, imgUrl, title) {
      var input = document.createElement("input");
      input.type = "radio"; input.name = "brand"; input.value = value;
      input.checked = value === chosen;
      input.addEventListener("change", function () {
        chosen = value;
        var url = new URL(location.href);
        if (value) url.searchParams.set("empresa", value); else url.searchParams.delete("empresa");
        history.replaceState(null, "", url);
        onChange(value);
      });
      var span = document.createElement("span");
      if (imgUrl) {
        var img = document.createElement("img");
        img.src = imgUrl; img.alt = ""; img.width = 28; img.height = 28;
        span.append(img);
      }
      span.append(label);
      if (opts.count) {
        var n = document.createElement("small");
        n.className = "brand-count";
        n.textContent = opts.count(value);
        span.append(n);
      }
      var lab = document.createElement("label");
      if (!imgUrl) lab.className = "brand-all";
      if (title) lab.title = title;
      lab.append(input, span);
      return lab;
    }

    box.replaceChildren(option("", "Todas as empresas"));
    brands.forEach(function (b) {
      var pic = b.icon || b.logo, name = b.name || "Empresa sem nome";
      box.append(option(b.id, name, pic ? pic.url : "/assets/favicon/favicon.png", opts.title ? opts.title(name) : ""));
    });
    extra.forEach(function (x) { box.append(option(x.value, x.label)); });
    box.hidden = brands.length + extra.length < 2;
    return function () { return chosen; };
  }

  // Canais de divulgação com link pronto na página do produto (utm_source). O Resumo usa os mesmos
  // nomes. Para um canal novo, acrescente uma linha.
  var UTM_SOURCES = [
    { value: "instagram", label: "Instagram" },
    { value: "whatsapp", label: "WhatsApp" }
  ];

  window.Admin = {
    UTM_SOURCES: UTM_SOURCES, brandSwitch: brandSwitch, BLOCK_ICONS: BLOCK_ICONS, blockIcon: blockIcon, usagePopover: usagePopover, searchFilter: searchFilter,
    api: api, requireSession: requireSession, formatPrice: formatPrice,
    showMessage: showMessage, confirm: confirmAction, setFlash: setFlash, takeFlash: takeFlash,
    uploadImage: uploadImage, formatBytes: formatBytes, viewImage: viewImage, pickImage: pickImage,
    imageField: imageField, STATUS: STATUS,
    hasUnsavedChanges: function () { return false; }, // páginas com formulário substituem esta função
    leaving: false
  };
})();
