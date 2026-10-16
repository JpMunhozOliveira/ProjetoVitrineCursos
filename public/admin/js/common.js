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
  // clique fora da imagem. Uso: Admin.viewImage({ url, alt, title, width, height })
  var viewer = null;
  function viewImage(image) {
    if (!viewer) {
      viewer = document.createElement("dialog");
      viewer.className = "viewer";
      viewer.setAttribute("aria-labelledby", "viewer-title");
      viewer.innerHTML = '<div class="viewer-head"><h2 id="viewer-title"></h2>' +
        '<button class="btn btn-sm btn-outline" type="button">Fechar</button></div>' +
        '<img alt=""><p class="viewer-info muted small"></p>';
      viewer.querySelector("button").addEventListener("click", function () { viewer.close(); });
      // O clique no fundo escurecido chega ao próprio <dialog> (e não a um filho dele).
      viewer.addEventListener("click", function (e) { if (e.target === viewer) viewer.close(); });
      document.body.append(viewer);
    }
    var img = viewer.querySelector("img");
    img.src = image.url;
    img.alt = image.alt || "";
    img.width = image.width; img.height = image.height;
    viewer.querySelector("h2").textContent = image.title || "Imagem";
    viewer.querySelector(".viewer-info").textContent = image.width + "×" + image.height + " px" +
      (image.alt ? " · " + image.alt : " · sem texto alternativo");
    viewer.showModal();
  }

  // Seletor de imagens da biblioteca (com envio de imagem nova no próprio diálogo).
  // Uso: var media = await Admin.pickImage({ currentId }); // null = fechou sem escolher
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
        '<p class="msg picker-msg" role="status" aria-live="polite"></p><div class="media-grid"></div>';
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

  window.Admin = {
    api: api, requireSession: requireSession, formatPrice: formatPrice,
    showMessage: showMessage, confirm: confirmAction, setFlash: setFlash, takeFlash: takeFlash,
    uploadImage: uploadImage, formatBytes: formatBytes, viewImage: viewImage, pickImage: pickImage, IMAGE_TYPES: IMAGE_TYPES, STATUS: STATUS,
    hasUnsavedChanges: function () { return false; }, // páginas com formulário substituem esta função
    leaving: false
  };
})();
