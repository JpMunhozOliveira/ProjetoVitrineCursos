/* Lista de produtos (página inicial do painel). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var msg = $("msg"), table = $("products"), body = table.querySelector("tbody");

  function cell(row, content) {
    var td = document.createElement("td");
    if (content instanceof Node) td.append(content); else td.textContent = content;
    row.append(td);
    return td;
  }

  function button(label, className, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sm " + className;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  // Publicado: só pode ser arquivado. Rascunho/arquivado: pode ser excluído (regra da API).
  async function archive(p) {
    var ok = await Admin.confirm({
      title: "Arquivar “" + p.title + "”?",
      text: "O produto sai do site, mas continua no painel e pode ser publicado de novo.",
      action: "Arquivar"
    });
    if (!ok) return;
    await run(function () { return Admin.api("/products/" + p.id, { method: "PATCH", body: { status: "archived" } }); },
      "“" + p.title + "” foi arquivado.");
  }

  async function remove(p) {
    var ok = await Admin.confirm({
      title: "Excluir “" + p.title + "”?",
      text: "Esta ação é permanente: o produto e a página de vendas dele serão apagados.",
      action: "Excluir definitivamente",
      danger: true
    });
    if (!ok) return;
    await run(function () { return Admin.api("/products/" + p.id, { method: "DELETE" }); },
      "“" + p.title + "” foi excluído.");
  }

  async function run(request, successText) {
    try {
      await request();
      await load();
      Admin.showMessage(msg, successText, "success");
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    }
  }

  function render(products) {
    body.replaceChildren();
    products.forEach(function (p) {
      var tr = document.createElement("tr");
      var link = document.createElement("a");
      link.href = "produto.html?id=" + encodeURIComponent(p.id);
      link.textContent = p.title;
      var slug = document.createElement("div");
      slug.className = "muted small";
      slug.textContent = "/" + p.slug;

      cell(tr, link).append(slug);
      cell(tr, Admin.STATUS[p.status] || p.status).className = "status-" + p.status;
      cell(tr, Admin.formatPrice(p.price_cents));
      cell(tr, new Date(p.updated_at).toLocaleString("pt-BR"));

      var actions = document.createElement("div");
      actions.className = "row-actions";
      var edit = document.createElement("a");
      edit.className = "btn btn-sm btn-outline";
      edit.href = link.href;
      edit.textContent = "Editar";
      edit.setAttribute("aria-label", "Editar " + p.title);
      actions.append(edit);

      var extra = p.status === "published"
        ? button("Arquivar", "btn-outline", function () { archive(p); })
        : button("Excluir", "btn-danger", function () { remove(p); });
      extra.setAttribute("aria-label", extra.textContent + " " + p.title);
      actions.append(extra);
      cell(tr, actions);

      body.append(tr);
    });

    table.hidden = !products.length;
    Admin.showMessage(msg, products.length ? "" : "Nenhum produto cadastrado ainda.");
  }

  async function load() {
    render(await Admin.api("/products"));
  }

  (async function () {
    try {
      await Admin.requireSession();
      await load();
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    }
  })();
})();
