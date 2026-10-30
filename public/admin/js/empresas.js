/* Empresas: nome e logo de quem vende, cadastrados uma vez e escolhidos em cada produto.
   Salvar uma empresa muda na hora todos os produtos dela (menu e rodapé da página de vendas e
   cards do catálogo). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var msg = $("msg"), list = $("list"), form = $("brand-form"), formMsg = $("form-msg");
  var editing = null; // empresa em edição (null = nova)
  var dirty = false;

  Admin.hasUnsavedChanges = function () { return !form.hidden && dirty; };
  window.addEventListener("beforeunload", function (e) {
    if (Admin.hasUnsavedChanges() && !Admin.leaving) { e.preventDefault(); e.returnValue = ""; }
  });

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, className, onClick) {
    var b = el("button", className, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  // Nome para mostrar no painel (a empresa pode ter só logo).
  function title(b) { return b.name || "Empresa sem nome (só logo)"; }

  var logo = Admin.imageField("logo", {
    title: "Logo da empresa", removed: "Logo removido.",
    apply: "Clique em Salvar para usá-lo nos produtos desta empresa.",
    hint: "Tamanho recomendado: 400 × 100 px, PNG com fundo transparente."
  }, function () { dirty = true; });
  var icon = Admin.imageField("icon", {
    title: "Ícone da aba", removed: "Ícone removido (a aba volta a usar o logo).",
    apply: "Clique em Salvar para usá-lo na aba das páginas de vendas.",
    hint: "Tamanho recomendado: 512 × 512 px (quadrada), PNG com fundo transparente."
  }, function () { dirty = true; });

  /* ---------- Conta Kiwify ----------
     Conectar e desconectar valem na hora (não dependem do Salvar): o servidor testa as chaves com
     a Kiwify antes de guardar. O Client Secret nunca volta do servidor. */
  var kiwify = (function () {
    var fields = ["kiwify-account", "kiwify-client", "kiwify-secret"].map($);
    var kmsg = $("kiwify-msg");

    function show(brand) {
      $("kiwify-new").hidden = !!brand;
      $("kiwify-box").hidden = !brand;
      fields.forEach(function (f) { f.value = ""; });
      Admin.showMessage(kmsg, "");
      var k = brand && brand.kiwify;
      var status = $("kiwify-status");
      status.textContent = k
        ? "Conectada: Account ID " + k.account_id + ", Client ID terminado em …" + k.client_id_hint + "."
        : "Não conectada: o preço e o link dos produtos desta empresa são preenchidos à mão.";
      status.classList.toggle("ok", !!k);
      if (k) fields[0].value = k.account_id;
      $("kiwify-connect").textContent = k ? "Trocar chaves" : "Conectar";
      $("kiwify-disconnect").hidden = !k;
    }

    $("kiwify-connect").addEventListener("click", async function () {
      var body = { account_id: fields[0].value.trim(), client_id: fields[1].value.trim(), client_secret: fields[2].value.trim() };
      var empty = fields.find(function (f, i) { return !body[["account_id", "client_id", "client_secret"][i]]; });
      if (empty) { Admin.showMessage(kmsg, "Preencha Account ID, Client ID e Client Secret.", "error"); empty.focus(); return; }
      var btn = this;
      btn.disabled = true;
      Admin.showMessage(kmsg, "Testando as chaves com a Kiwify…");
      try {
        var k = await Admin.api("/brands/" + encodeURIComponent(editing.id) + "/kiwify", { method: "PUT", body: body });
        editing.kiwify = k;
        show(editing);
        Admin.showMessage(kmsg, "Conta conectada. Agora, em “Editar produto”, escolha o produto da Kiwify na parte Venda.", "success");
        refreshCards();
      } catch (err) {
        Admin.showMessage(kmsg, err.message, "error");
      } finally {
        btn.disabled = false;
        fields[2].value = ""; // o segredo não fica na tela
      }
    });

    $("kiwify-disconnect").addEventListener("click", async function () {
      var ok = await Admin.confirm({
        title: "Desconectar a conta Kiwify?",
        text: "As chaves serão apagadas do site. Os produtos desta empresa mantêm o último preço e link, mas param de se atualizar sozinhos.",
        action: "Desconectar", danger: true
      });
      if (!ok) return;
      try {
        await Admin.api("/brands/" + encodeURIComponent(editing.id) + "/kiwify", { method: "DELETE" });
        editing.kiwify = null;
        show(editing);
        Admin.showMessage(kmsg, "Conta desconectada.", "success");
        refreshCards();
      } catch (err) {
        Admin.showMessage(kmsg, err.message, "error");
      }
    });

    return { show: show };
  })();

  // Atualiza a lista sem fechar o formulário (ex.: depois de conectar a Kiwify).
  async function refreshCards() {
    try { await load(); } catch (e) { /* a lista se atualiza no próximo carregamento */ }
  }

  /* ---------- Formulário ---------- */
  function openForm(brand) {
    editing = brand;
    $("form-title").textContent = brand ? "Editar “" + title(brand) + "”" : "Nova empresa";
    $("name").value = brand ? brand.name || "" : "";
    $("is_default").checked = !!(brand && brand.is_default);
    logo.show(brand && brand.logo ? Object.assign({}, brand.logo) : null);
    logo.clearMessage();
    icon.show(brand && brand.icon ? Object.assign({}, brand.icon) : null);
    icon.clearMessage();
    kiwify.show(brand);
    Admin.showMessage(formMsg, brand && brand.usage.length
      ? "Usada em " + brand.usage.length + " produto(s): ao salvar, todos mudam na hora." : "");
    dirty = false;
    form.hidden = false;
    $("new").hidden = true;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("name").focus({ preventScroll: true });
  }

  async function closeForm() {
    if (dirty && !(await Admin.confirm({
      title: "Descartar as alterações?", text: "O que você mudou nesta empresa será perdido.",
      action: "Descartar", cancel: "Continuar editando", danger: true
    }))) return false;
    form.hidden = true;
    $("new").hidden = false;
    editing = null;
    dirty = false;
    return true;
  }

  $("name").addEventListener("input", function () { dirty = true; });
  $("is_default").addEventListener("change", function () { dirty = true; });
  $("logo-alt").addEventListener("input", function () { dirty = true; });
  $("icon-alt").addEventListener("input", function () { dirty = true; });
  $("new").addEventListener("click", async function () {
    if (!form.hidden && !(await closeForm())) return;
    openForm(null);
  });
  $("cancel").addEventListener("click", closeForm);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var body = {
      name: $("name").value, logo_id: logo.image ? logo.image.id : null, icon_id: icon.image ? icon.image.id : null,
      is_default: $("is_default").checked
    };
    if (!body.name.trim() && !body.logo_id) {
      Admin.showMessage(formMsg, "Informe o nome da empresa, o logo ou os dois.", "error");
      $("name").focus();
      return;
    }
    var save = $("save");
    save.disabled = true;
    Admin.showMessage(formMsg, "Salvando…");
    try {
      await logo.saveAlt();
      await icon.saveAlt();
      var saved = editing
        ? await Admin.api("/brands/" + encodeURIComponent(editing.id), { method: "PUT", body: body })
        : await Admin.api("/brands", { method: "POST", body: body });
      dirty = false;
      form.hidden = true;
      $("new").hidden = false;
      editing = null;
      await load();
      Admin.showMessage(msg, saved.usage.length
        ? "“" + title(saved) + "” salva: os " + saved.usage.length + " produto(s) dela já mostram a versão nova."
        : "“" + title(saved) + "” salva." + (saved.is_default ? " Ela é a empresa padrão: o menu do site já mostra o logo dela." : " Para usá-la, abra um produto e escolha-a na parte Venda."), "success");
      focusCard(saved.id);
    } catch (err) {
      Admin.showMessage(formMsg, err.status === 401
        ? "Sua sessão expirou. Entre novamente em outra aba e clique em Salvar de novo (os dados desta tela foram mantidos)."
        : err.message, "error");
    } finally {
      save.disabled = false;
    }
  });

  /* ---------- Lista ---------- */
  // Prévia como no menu da página de vendas: logo e/ou nome sobre fundo escuro.
  function preview(b) {
    var box = el("div", "cover-preview brand-preview brand-pick-preview");
    if (b.logo) {
      var img = el("img");
      img.src = b.logo.url; img.width = b.logo.width; img.height = b.logo.height;
      img.alt = b.name ? "" : b.logo.alt_text || "";
      img.loading = "lazy";
      box.append(img);
    }
    if (b.name) box.append(el("span", "", b.name));
    return box;
  }

  function card(b) {
    var li = el("li", "media-card brand-card");
    li.id = b.id;
    li.dataset.id = b.id;
    var body = el("div", "media-body");
    // Cabeçalho: ícone da aba do navegador (próprio, o logo ou o do site) à esquerda do nome.
    var head = el("div", "shared-head");
    var tabIcon = el("span", "shared-icon brand-tab-icon");
    var tabImg = b.icon || b.logo;
    var img = el("img");
    img.src = tabImg ? tabImg.url : "/assets/favicon/favicon.png"; img.alt = ""; img.width = 24; img.height = 24; img.loading = "lazy";
    tabIcon.append(img);
    tabIcon.title = b.icon ? "Ícone da aba do navegador: próprio" : b.logo ? "Ícone da aba do navegador: usa o logo" : "Ícone da aba do navegador: o do site";
    var heading = el("div", "shared-title");
    var name = el("strong", "shared-name", title(b));
    heading.append(name, el("span", "muted small", "Atualizada em " + new Date(b.updated_at).toLocaleDateString("pt-BR")));
    head.append(tabIcon, heading);
    body.append(head);

    // Linha final: uso, Padrão e Kiwify à esquerda; Editar e (sem uso) o "×" de excluir à direita.
    var foot = el("div", "media-tags shared-foot"), badges = el("div", "media-badges");
    badges.append(b.usage.length
      ? Admin.usagePopover(b.usage.map(function (u) {
        return { label: "", title: u.title, href: "produto.html?id=" + encodeURIComponent(u.id) };
      }), { prefix: "Possui", one: "produto", many: "produtos" })
      : el("span", "badge", "Sem uso"));
    if (b.is_default) {
      var def = el("span", "badge badge-default", "Padrão");
      def.title = "Empresa padrão do site: logo no menu e ícone na aba do navegador";
      badges.append(def);
    }
    var kw = el("span", "badge " + (b.kiwify ? "badge-kiwify-on" : "badge-alt"), b.kiwify ? "Kiwify" : "Sem Kiwify");
    kw.title = b.kiwify ? "Conta Kiwify conectada: preço e link dos produtos vêm da Kiwify" : "Conta Kiwify não conectada (Editar > Conta Kiwify)";
    badges.append(kw);

    var actions = el("div", "shared-actions");
    var edit = button("Editar", "btn btn-sm btn-outline", async function () {
      if (!form.hidden && !(await closeForm())) return;
      openForm(b);
    });
    edit.setAttribute("aria-label", "Editar " + title(b));
    actions.append(edit);
    // Empresa em uso não pode ser excluída (regra da API); o "×" nem aparece.
    if (!b.usage.length) {
      var del = button("×", "media-delete", async function () {
        var ok = await Admin.confirm({
          title: "Excluir “" + title(b) + "”?",
          text: "A empresa será apagada definitivamente (o logo continua na biblioteca de imagens)."
            + (b.is_default ? " Ela é a empresa padrão: o menu do site volta a mostrar o logo dos arquivos." : ""),
          action: "Excluir definitivamente", danger: true
        });
        if (!ok) return;
        try {
          await Admin.api("/brands/" + encodeURIComponent(b.id), { method: "DELETE" });
          if (editing && editing.id === b.id) { dirty = false; await closeForm(); }
          await load();
          Admin.showMessage(msg, "“" + title(b) + "” foi excluída.", "success");
        } catch (err) {
          Admin.showMessage(msg, err.message, "error");
        }
      });
      del.title = "Excluir";
      del.setAttribute("aria-label", "Excluir " + title(b));
      actions.append(del);
    }
    foot.append(badges, actions);
    body.append(foot);
    li.append(preview(b), body);
    return li;
  }

  function focusCard(id) {
    var c = id && document.getElementById(id);
    if (c) c.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Lista com a busca aplicada (nome da empresa e produtos dela).
  var all = [];
  function render() {
    var query = $("q").value.trim();
    var shown = Admin.searchFilter(all, query, function (b) {
      return [title(b)].concat(b.usage.map(function (u) { return u.title; })).join(" ");
    });
    list.replaceChildren.apply(list, shown.map(card));
    $("search").hidden = !all.length;
    $("count").textContent = query ? shown.length + " de " + all.length + " empresa(s)" : "";
    $("empty").hidden = all.length > 0;
    $("no-results").textContent = "Nenhuma empresa encontrada para “" + query + "”.";
    $("no-results").hidden = !(all.length && !shown.length);
  }

  async function load() {
    all = await Admin.api("/brands");
    render();
  }
  $("q").addEventListener("input", render);

  (async function () {
    try {
      await Admin.requireSession();
      await load();
      Admin.showMessage(msg, "");
      // Vindo da biblioteca de imagens (empresas.html#<id>): mostra a empresa.
      if (location.hash) focusCard(decodeURIComponent(location.hash.slice(1)));
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    }
  })();
})();
