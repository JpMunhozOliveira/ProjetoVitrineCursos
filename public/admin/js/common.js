/* Funções compartilhadas pelas páginas do painel (window.Admin). */
(function () {
  "use strict";
  var csrf = null;

  var STATUS = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };

  // Chama a API administrativa. Em requisições que alteram dados, envia o token CSRF da sessão.
  async function api(path, opts) {
    opts = opts || {};
    var method = opts.method || "GET", headers = { Accept: "application/json" };
    if (opts.body) headers["Content-Type"] = "application/json";
    if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
    var res = await fetch("/api/admin" + path, {
      method: method, headers: headers, credentials: "same-origin",
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
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
  // Uso: if (await Admin.confirm({ title, text, action: "Excluir", danger: true })) { ... }
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
    ok.classList.toggle("btn-danger", !!opts.danger);
    dialog.returnValue = "";
    dialog.showModal();
    dialog.querySelector('[value="cancel"]').focus(); // ação destrutiva nunca é o padrão
    return new Promise(function (resolve) {
      dialog.addEventListener("close", function () { resolve(dialog.returnValue === "ok"); }, { once: true });
    });
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

  window.Admin = {
    api: api, requireSession: requireSession, formatPrice: formatPrice,
    showMessage: showMessage, confirm: confirmAction, setFlash: setFlash, takeFlash: takeFlash,
    STATUS: STATUS,
    hasUnsavedChanges: function () { return false; }, // páginas com formulário substituem esta função
    leaving: false
  };
})();
