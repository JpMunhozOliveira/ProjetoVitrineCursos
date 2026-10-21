/* Blocos salvos: conteúdo usado em várias páginas de vendas (ex.: redes sociais de um professor).
   O formulário é montado a partir do esquema dos blocos (/sales-blocks), com os campos que vêm do
   bloco salvo (os campos "locais", como o fundo, continuam sendo escolhidos em cada página). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var msg = $("msg"), list = $("list"), form = $("block-form"), formMsg = $("form-msg");
  var schema = null, all = [];
  var editing = null; // { id (null = novo), type, data }
  var dirty = false, uid = 0;

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

  // Campos do tipo que vêm do bloco salvo (sem os locais, que ficam em cada página).
  function sharedFields(type) {
    var local = schema.shareable[type] || [], out = {};
    Object.keys(schema.blocks[type].fields).forEach(function (name) {
      if (local.indexOf(name) < 0) out[name] = schema.blocks[type].fields[name];
    });
    return out;
  }

  function emptyValue(fields) {
    var out = {};
    Object.keys(fields).forEach(function (name) {
      var f = fields[name];
      out[name] = f.type === "list" ? [] : f.type === "bool" ? false : f.type === "choice" ? f.default : "";
    });
    return out;
  }

  /* ---------- Formulário a partir do esquema ---------- */
  function changed() { dirty = true; }

  // Campo simples (texto, texto longo, link, opção, sim/não) ligado a value[name].
  function simpleField(field, value, name) {
    var id = "f" + (++uid), wrap = el("div", "field" + (field.type === "bool" ? " check" : ""));
    var label = el("label", "", field.label);
    label.htmlFor = id;
    var input;
    if (field.type === "textarea") {
      input = el("textarea"); input.rows = 3;
    } else if (field.type === "choice") {
      input = el("select");
      Object.keys(field.options).forEach(function (key) {
        var o = el("option", "", field.options[key]); o.value = key; input.append(o);
      });
    } else {
      input = el("input");
      if (field.type === "bool") input.type = "checkbox";
      if (field.type === "url") { input.inputMode = "url"; input.spellcheck = false; input.autocapitalize = "none"; }
    }
    input.id = id;
    if (field.max) input.maxLength = field.max;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.type === "bool") input.checked = !!value[name]; else input.value = value[name] || "";
    input.addEventListener(field.type === "bool" || field.type === "choice" ? "change" : "input", function () {
      value[name] = field.type === "bool" ? input.checked : input.value;
      changed();
    });
    if (field.type === "bool") wrap.append(input, label); else wrap.append(label, input);
    if (field.help) {
      var help = el("p", "hint", field.help);
      help.id = id + "-help";
      input.setAttribute("aria-describedby", help.id);
      wrap.append(help);
    }
    return wrap;
  }

  // Lista (ex.: redes): cada item com os seus campos, mover, remover e "Adicionar <item>".
  function listField(field, value, name) {
    var box = el("fieldset", "list-field");
    box.append(el("legend", "", field.label));
    var items = el("ol", "list-items");
    var add = button("+ Adicionar " + field.noun, "btn btn-sm btn-outline", function () {
      value[name].push(emptyValue(field.item));
      changed();
      draw();
      var inputs = items.lastElementChild && items.lastElementChild.querySelector("input, select, textarea");
      if (inputs) inputs.focus();
    });
    function move(i, delta) {
      var arr = value[name], item = arr.splice(i, 1)[0];
      arr.splice(i + delta, 0, item);
      changed();
      draw();
    }
    function draw() {
      items.replaceChildren();
      value[name].forEach(function (item, i) {
        var li = el("li", "list-item");
        var head = el("div", "list-item-head");
        head.append(el("strong", "", field.noun.charAt(0).toUpperCase() + field.noun.slice(1) + " " + (i + 1)));
        var actions = el("div", "row-actions");
        var up = button("↑", "btn btn-sm btn-outline", function () { move(i, -1); });
        up.disabled = i === 0; up.setAttribute("aria-label", "Mover " + field.noun + " " + (i + 1) + " para cima");
        var down = button("↓", "btn btn-sm btn-outline", function () { move(i, 1); });
        down.disabled = i === value[name].length - 1; down.setAttribute("aria-label", "Mover " + field.noun + " " + (i + 1) + " para baixo");
        var remove = button("Remover", "btn btn-sm btn-danger", function () {
          value[name].splice(i, 1);
          changed();
          draw();
          add.focus();
        });
        remove.setAttribute("aria-label", "Remover " + field.noun + " " + (i + 1));
        actions.append(up, down, remove);
        head.append(actions);
        var grid = el("div", "list-item-fields");
        Object.keys(field.item).forEach(function (key) { grid.append(simpleField(field.item[key], item, key)); });
        li.append(head, grid);
        items.append(li);
      });
      add.disabled = value[name].length >= field.max;
      add.title = add.disabled ? "Máximo de " + field.max : "";
    }
    draw();
    box.append(items, add);
    return box;
  }

  function buildForm(type, data) {
    var fields = sharedFields(type);
    var box = el("fieldset");
    box.append(el("legend", "", "Conteúdo"));
    if (schema.blocks[type].help) box.append(el("p", "hint", schema.blocks[type].help));
    Object.keys(fields).forEach(function (name) {
      box.append(fields[name].type === "list" ? listField(fields[name], data, name) : simpleField(fields[name], data, name));
    });
    $("fields").replaceChildren(box);
  }

  function openForm(block) {
    var type = block ? block.type : "social";
    var data = Object.assign(emptyValue(sharedFields(type)), block ? JSON.parse(JSON.stringify(block.data)) : {});
    // Bloco novo de redes já começa com uma linha para preencher.
    if (!block && data.items && !data.items.length) data.items.push(emptyValue(sharedFields(type).items.item));
    editing = { id: block ? block.id : null, type: type, data: data };
    $("form-title").textContent = block ? "Editar “" + block.name + "”" : "Novo bloco de " + schema.blocks[type].label.toLowerCase();
    $("name").value = block ? block.name : "";
    buildForm(type, data);
    Admin.showMessage(formMsg, block && block.usage.length
      ? "Usado em " + block.usage.length + " página(s): ao salvar, todas mudam na hora." : "");
    dirty = false;
    form.hidden = false;
    $("new").hidden = true;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("name").focus({ preventScroll: true });
  }

  async function closeForm() {
    if (dirty && !(await Admin.confirm({
      title: "Descartar as alterações?", text: "O que você mudou neste bloco será perdido.",
      action: "Descartar", cancel: "Continuar editando", danger: true,
    }))) return false;
    form.hidden = true;
    $("new").hidden = false;
    editing = null;
    dirty = false;
    return true;
  }

  $("name").addEventListener("input", changed);
  $("new").addEventListener("click", function () { openForm(null); });
  $("cancel").addEventListener("click", closeForm);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var save = $("save");
    save.disabled = true;
    Admin.showMessage(formMsg, "Salvando…");
    var body = { name: $("name").value, data: editing.data };
    try {
      var saved = editing.id
        ? await Admin.api("/shared-blocks/" + encodeURIComponent(editing.id), { method: "PUT", body: body })
        : await Admin.api("/shared-blocks", { method: "POST", body: Object.assign({ type: editing.type }, body) });
      dirty = false;
      form.hidden = true;
      $("new").hidden = false;
      editing = null;
      await load();
      Admin.showMessage(msg, saved.usage.length
        ? "“" + saved.name + "” salvo: as " + saved.usage.length + " página(s) que o usam já mostram a versão nova."
        : "“" + saved.name + "” salvo. Para usá-lo, abra o editor de uma página de vendas e escolha-o em “+” › Blocos salvos.", "success");
      var card = list.querySelector('[data-id="' + saved.id + '"]');
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      Admin.showMessage(formMsg, err.message, "error");
    } finally {
      save.disabled = false;
    }
  });

  /* ---------- Lista ---------- */
  function summary(block) {
    if (block.type === "social") {
      var nets = (block.data.items || []).filter(function (x) { return x.url; })
        .map(function (x) { return (schema.networks[x.network] || {}).label || x.network; });
      return nets.length ? nets.join(" · ") : "Nenhuma rede com link (o bloco não aparece nas páginas).";
    }
    return schema.blocks[block.type].label;
  }

  function card(block) {
    var li = el("li", "media-card shared-card");
    li.dataset.id = block.id;
    var body = el("div", "media-body");
    body.append(el("strong", "media-name", block.name));
    body.append(el("span", "muted small", schema.blocks[block.type].label + " · atualizado em " +
      new Date(block.updated_at).toLocaleDateString("pt-BR")));
    body.append(el("p", "small", summary(block)));

    var usage = el("p", "media-usage small");
    if (block.usage.length) {
      usage.append("Usado nas páginas de: ");
      block.usage.forEach(function (u, i) {
        if (i) usage.append(", ");
        var a = el("a", "", u.title);
        a.href = "pagina.html?id=" + encodeURIComponent(u.id);
        usage.append(a);
      });
    } else {
      usage.append(el("span", "badge", "Sem uso"));
    }
    body.append(usage);

    var actions = el("div", "row-actions");
    actions.append(button("Editar", "btn btn-sm", async function () {
      if (!form.hidden && !(await closeForm())) return;
      openForm(block);
    }));
    // Bloco em uso não pode ser excluído (regra da API); o botão nem aparece.
    if (!block.usage.length) {
      var del = button("Excluir", "btn btn-sm btn-danger", async function () {
        var ok = await Admin.confirm({
          title: "Excluir “" + block.name + "”?", text: "O bloco salvo será apagado definitivamente.",
          action: "Excluir definitivamente", danger: true,
        });
        if (!ok) return;
        try {
          await Admin.api("/shared-blocks/" + encodeURIComponent(block.id), { method: "DELETE" });
          if (editing && editing.id === block.id) { dirty = false; await closeForm(); }
          await load();
          Admin.showMessage(msg, "“" + block.name + "” foi excluído.", "success");
        } catch (err) {
          Admin.showMessage(msg, err.message, "error");
        }
      });
      del.setAttribute("aria-label", "Excluir " + block.name);
      actions.append(del);
    }
    body.append(actions);
    li.append(body);
    return li;
  }

  async function load() {
    all = await Admin.api("/shared-blocks");
    list.replaceChildren.apply(list, all.map(card));
    $("empty").hidden = all.length > 0;
  }

  (async function () {
    try {
      await Admin.requireSession();
      schema = await Admin.api("/sales-blocks");
      await load();
      Admin.showMessage(msg, "");
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    }
  })();
})();
