/* Lista de produtos (página inicial do painel). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var msg = $("msg"), table = $("products"), body = table.querySelector("tbody");

  // data-label: nome da coluna, exibido pelo CSS quando a tabela vira cartões no celular.
  function cell(row, label, content) {
    var td = document.createElement("td");
    td.dataset.label = label;
    if (content instanceof Node) td.append(content); else td.textContent = content;
    row.append(td);
    return td;
  }

  // Seletor de situação que grava na hora (PATCH só com o status).
  function statusSelect(p) {
    var select = document.createElement("select");
    select.className = "status-select status-" + p.status;
    select.dataset.id = p.id;
    select.setAttribute("aria-label", "Situação de " + p.title);
    Object.keys(Admin.STATUS).forEach(function (value) {
      select.append(new Option(Admin.STATUS[value], value, false, value === p.status));
    });
    select.addEventListener("change", async function () {
      var next = select.value;
      select.disabled = true;
      try {
        await Admin.api("/products/" + p.id, { method: "PATCH", body: { status: next } });
        await load(); // recarrega: o botão Excluir depende da nova situação
        var again = body.querySelector('select[data-id="' + p.id + '"]'); // devolve o foco ao teclado
        if (again) again.focus();
        Admin.showMessage(msg, "“" + p.title + "” agora está como " + Admin.STATUS[next].toLowerCase() + ".", "success");
      } catch (err) {
        select.value = p.status; // volta ao valor gravado
        select.disabled = false;
        Admin.showMessage(msg, err.message, "error");
      }
    });
    return select;
  }

  // Exclusão só para rascunho/arquivado (regra da API); publicado precisa ser arquivado antes.
  async function remove(p) {
    var ok = await Admin.confirm({
      title: "Excluir “" + p.title + "”?",
      text: "Esta ação é permanente: o produto e a página de vendas dele serão apagados.",
      action: "Excluir definitivamente",
      danger: true
    });
    if (!ok) return;
    try {
      await Admin.api("/products/" + p.id, { method: "DELETE" });
      await load();
      Admin.showMessage(msg, "“" + p.title + "” foi excluído.", "success");
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    }
  }

  var all = [];          // lista completa vinda da API
  var search = $("q"), count = $("count");

  // Busca sem diferenciar maiúsculas nem acentos: "tributaria" encontra "Tributária".
  function normalize(text) {
    return (text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function matches(p, terms) {
    var haystack = normalize([p.title, p.category, p.slug].join(" "));
    return terms.every(function (t) { return haystack.indexOf(t) >= 0; }); // todas as palavras precisam aparecer
  }

  // Aplica a busca atual sobre a lista completa e redesenha.
  function applyFilter() {
    var terms = normalize(search.value).split(/\s+/).filter(Boolean);
    var shown = terms.length ? all.filter(function (p) { return matches(p, terms); }) : all;
    render(shown);

    $("search").hidden = !all.length;
    count.textContent = terms.length ? shown.length + " de " + all.length + " produto(s)" : "";
    var empty = !all.length ? "Nenhum produto cadastrado ainda."
      : !shown.length ? "Nenhum produto encontrado para “" + search.value.trim() + "”." : "";
    $("empty").textContent = empty;
    $("empty").hidden = !empty;
  }

  function render(products) {
    body.replaceChildren();
    products.forEach(function (p) {
      var tr = document.createElement("tr");
      var link = document.createElement("a");
      link.href = "produto.html?id=" + encodeURIComponent(p.id);
      link.className = "cell-title";
      link.textContent = p.title;
      link.title = p.title; // texto completo ao passar o mouse (o nome longo é cortado em 1 linha)
      var details = document.createElement("div");
      details.className = "muted small cell-sub";
      details.textContent = "/" + p.slug + (p.category ? " · " + p.category : "");
      details.title = details.textContent;

      cell(tr, "Produto", link).append(details);
      cell(tr, "Situação", statusSelect(p));
      var price = cell(tr, "Preço", Admin.formatPrice(p.price_cents));
      if (p.kiwify_product_id) { // preço e link vêm da Kiwify (atualizados sozinhos)
        var kw = document.createElement("span");
        kw.className = "badge badge-kiwify";
        kw.textContent = p.kiwify_sync_error ? "Kiwify !" : "Kiwify";
        kw.title = p.kiwify_sync_error ? "Última atualização falhou: " + p.kiwify_sync_error : "Preço e link vindos da Kiwify";
        price.append(kw);
      }
      cell(tr, "Atualizado em", new Date(p.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }));

      var actions = document.createElement("div");
      actions.className = "row-actions";
      var edit = document.createElement("a");
      edit.className = "btn btn-sm btn-outline";
      edit.href = link.href;
      edit.textContent = "Editar";
      edit.setAttribute("aria-label", "Editar " + p.title);
      actions.append(edit);

      if (p.status !== "published") {
        var del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-sm btn-danger";
        del.textContent = "Excluir";
        del.setAttribute("aria-label", "Excluir " + p.title);
        del.addEventListener("click", function () { remove(p); });
        actions.append(del);
      }
      cell(tr, "Ações", actions);

      body.append(tr);
    });

    table.hidden = !products.length;
  }

  // Recarrega da API mantendo o que está digitado na busca.
  async function load() {
    all = await Admin.api("/products");
    applyFilter();
  }

  search.addEventListener("input", applyFilter);

  (async function () {
    try {
      await Admin.requireSession();
      await load();
      Admin.showMessage(msg, "");
      var flash = Admin.takeFlash();
      if (flash) Admin.showMessage(msg, flash, "success");
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    }
  })();
})();
