/* Blocos salvos: conteúdo usado em várias páginas de vendas (ex.: Autor ou redes sociais de um
   professor). Qualquer tipo de bloco pode ser salvo. Esta aba lista os blocos, cria novos e exclui;
   o conteúdo é editado no editor visual (pagina.html?bloco=<id>), como numa página. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var msg = $("msg"), list = $("list"), form = $("new-form"), formMsg = $("form-msg");
  var schema = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  var editUrl = function (id) { return "pagina.html?bloco=" + encodeURIComponent(id); };
  var label = function (type) { return (schema.blocks[type] || {}).label || type; };

  /* ---------- Novo bloco salvo ---------- */
  function showForm(open) {
    form.hidden = !open;
    $("new").setAttribute("aria-expanded", String(open));
    Admin.showMessage(formMsg, "");
    if (open) { updatePlaceholder(); $("type").focus(); } else { $("new").focus(); }
  }
  function updatePlaceholder() { $("name").placeholder = "Ex.: " + label($("type").value) + " — Prof. Fulano"; }

  // Conteúdo inicial: o bloco de exemplo do modelo padrão (sem os campos que ficam em cada página).
  function starterData(type) {
    var sample = (schema.defaultSections || []).filter(function (b) { return b.type === type; })[0];
    var data = sample ? JSON.parse(JSON.stringify(sample)) : {};
    delete data.type;
    (schema.shareable[type] || []).forEach(function (name) { delete data[name]; });
    return data;
  }

  $("new").addEventListener("click", function () { showForm(form.hidden); });
  $("cancel").addEventListener("click", function () { showForm(false); });
  $("type").addEventListener("change", updatePlaceholder);
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var type = $("type").value, create = $("create");
    create.disabled = true;
    Admin.showMessage(formMsg, "Criando…");
    try {
      var saved = await Admin.api("/shared-blocks", {
        method: "POST", body: { type: type, name: $("name").value, data: starterData(type) }
      });
      Admin.leaving = true;
      location.href = editUrl(saved.id); // abre o editor para trocar o conteúdo de exemplo
    } catch (err) {
      Admin.showMessage(formMsg, err.message, "error");
      create.disabled = false;
    }
  });

  /* ---------- Lista ---------- */
  // Texto sem as marcações de formatação ([b], [c=accent], [align=center]...).
  function plain(value) {
    return String(value || "").replace(/^\[align=[a-z]+\]/, "").replace(/\[\/?(?:b|i|c)(?:=[a-z]+)?\]/g, "")
      .replace(/\[\[/g, "[").replace(/\s+/g, " ").trim();
  }

  // Resumo do bloco: o primeiro texto que o identifica (título, nome...; senão, o do primeiro item).
  function summary(block) {
    var fields = (schema.blocks[block.type] || {}).fields || {}, data = block.data || {};
    if (block.type === "social") {
      var nets = (data.items || []).filter(function (x) { return x.url; })
        .map(function (x) { return (schema.networks[x.network] || {}).label || x.network; });
      return nets.length ? nets.join(" · ") : "Nenhuma rede com link (o bloco não aparece nas páginas).";
    }
    var names = Object.keys(fields).filter(function (n) { return n !== "eyebrow"; });
    for (var i = 0; i < names.length; i++) {
      var f = fields[names[i]];
      if ((f.type === "text" || f.type === "textarea") && plain(data[names[i]])) return plain(data[names[i]]);
    }
    for (var j = 0; j < names.length; j++) {
      var item = fields[names[j]].type === "list" && (data[names[j]] || [])[0];
      if (!item) continue;
      var key = Object.keys(item).filter(function (k) { return typeof item[k] === "string" && plain(item[k]); })[0];
      if (key) return plain(item[key]);
    }
    return "Sem texto ainda.";
  }

  // Cartão: ícone do tipo de bloco, nome, resumo e, na última linha, onde é usado + Editar e "×".
  function card(block) {
    var li = el("li", "media-card shared-card");
    li.dataset.id = block.id;
    var body = el("div", "media-body");

    var head = el("div", "shared-head");
    var icon = el("span", "shared-icon");
    icon.append(Admin.blockIcon(block.type));
    var title = el("div", "shared-title");
    title.append(el("strong", "shared-name", block.name), el("span", "muted small", label(block.type) + " · atualizado em " +
      new Date(block.updated_at).toLocaleDateString("pt-BR")));
    head.append(icon, title);
    body.append(head);

    var text = summary(block);
    body.append(el("p", "small shared-summary", text.length > 140 ? text.slice(0, 140) + "…" : text));

    // Linha final: uso à esquerda; Editar e (sem uso) o "×" de excluir à direita.
    var foot = el("div", "media-tags shared-foot"), badges = el("div", "media-badges");
    badges.append(block.usage.length
      ? Admin.usagePopover(block.usage.map(function (u) {
        return { label: "", title: u.title, href: "pagina.html?id=" + encodeURIComponent(u.id) };
      }), { prefix: "Usado em", one: "página", many: "páginas" })
      : el("span", "badge", "Sem uso"));
    var actions = el("div", "shared-actions");
    var edit = el("a", "btn btn-sm btn-outline", "Editar");
    edit.href = editUrl(block.id);
    edit.setAttribute("aria-label", "Editar " + block.name);
    actions.append(edit);
    // Bloco em uso não pode ser excluído (regra da API); o "×" nem aparece.
    if (!block.usage.length) {
      var del = el("button", "media-delete", "×");
      del.type = "button";
      del.title = "Excluir";
      del.setAttribute("aria-label", "Excluir " + block.name);
      del.addEventListener("click", async function () {
        var ok = await Admin.confirm({
          title: "Excluir “" + block.name + "”?", text: "O bloco salvo será apagado definitivamente.",
          action: "Excluir definitivamente", danger: true
        });
        if (!ok) return;
        try {
          await Admin.api("/shared-blocks/" + encodeURIComponent(block.id), { method: "DELETE" });
          await load();
          Admin.showMessage(msg, "“" + block.name + "” foi excluído.", "success");
        } catch (err) {
          Admin.showMessage(msg, err.message, "error");
        }
      });
      actions.append(del);
    }
    foot.append(badges, actions);
    body.append(foot);
    li.append(body);
    return li;
  }

  // Lista com a busca aplicada (nome, tipo, resumo do texto e páginas onde o bloco é usado).
  var all = [];
  function render() {
    var query = $("q").value.trim();
    var shown = Admin.searchFilter(all, query, function (b) {
      return [b.name, label(b.type), summary(b)].concat(b.usage.map(function (u) { return u.title; })).join(" ");
    });
    list.replaceChildren.apply(list, shown.map(card));
    $("search").hidden = !all.length;
    $("count").textContent = query ? shown.length + " de " + all.length + " bloco(s)" : "";
    $("empty").hidden = all.length > 0;
    $("no-results").textContent = "Nenhum bloco encontrado para “" + query + "”.";
    $("no-results").hidden = !(all.length && !shown.length);
  }

  async function load() {
    all = await Admin.api("/shared-blocks");
    render();
  }
  $("q").addEventListener("input", render);

  (async function () {
    try {
      await Admin.requireSession();
      schema = await Admin.api("/sales-blocks");
      Object.keys(schema.blocks).forEach(function (type) {
        var o = el("option", "", schema.blocks[type].label);
        o.value = type;
        $("type").append(o);
      });
      await load();
      Admin.showMessage(msg, "");
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    }
  })();
})();
