/* Editor da página de vendas de um produto (pagina.html?id=...).
   A página fica em memória como um objeto igual ao JSON da API ({ sections: [...] }); cada
   campo da tela edita diretamente o pedaço do objeto a que pertence. Os formulários são
   gerados a partir do esquema do servidor (GET /api/admin/sales-blocks), a mesma fonte
   usada para validar — um tipo de bloco novo no servidor aparece aqui sem mudar este arquivo. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var productId = new URLSearchParams(location.search).get("id");
  var form = $("editor"), list = $("blocks"), msg = $("msg");

  var schema = null;         // { blocks, icons, maxBlocks, defaultSections }
  var product = null;
  var media = new Map();     // id -> imagem da biblioteca (para mostrar miniaturas)
  var sections = [];         // os blocos sendo editados
  var page = null;           // página como está gravada (null = ainda não existe)
  var dirty = false;
  var open = new Set();      // blocos abertos (referências aos objetos)
  var uid = 0;
  var nextId = function () { return "f" + (++uid); };

  Admin.hasUnsavedChanges = function () { return dirty; };
  window.addEventListener("beforeunload", function (e) {
    if (dirty && !Admin.leaving) { e.preventDefault(); e.returnValue = ""; }
  });
  function touch() { dirty = true; updatePublishHint(); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(label, className, onClick, ariaLabel) {
    var b = el("button", className, label);
    b.type = "button";
    if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
    b.addEventListener("click", onClick);
    return b;
  }
  var copy = function (value) { return JSON.parse(JSON.stringify(value)); };

  /* ---------- Valores iniciais (a partir do esquema) ---------- */
  function emptyValue(fields) {
    var out = {};
    Object.keys(fields).forEach(function (k) {
      var t = fields[k].type;
      out[k] = t === "list" ? [] : t === "bool" ? false : t === "image" ? null : t === "icon" ? "check" : "";
    });
    return out;
  }
  // Listas já começam com um item vazio (menos as de imagem obrigatória, que exigem escolher).
  function newItem(field) { return emptyValue(field.item); }
  function startsWithItem(field) {
    return !Object.keys(field.item).some(function (k) { return field.item[k].required; });
  }
  function newBlock(type) {
    var fields = schema.blocks[type].fields, block = Object.assign({ type: type }, emptyValue(fields));
    Object.keys(fields).forEach(function (k) {
      if (fields[k].type === "list" && startsWithItem(fields[k])) block[k].push(newItem(fields[k]));
    });
    return block;
  }

  // Resumo exibido no cabeçalho do bloco recolhido (o primeiro texto que identifica o conteúdo).
  function summary(block) {
    var first = (block.items || [])[0] || {};
    return block.title || block.name || first.title || first.question || first.text || "";
  }

  /* ---------- Campos ---------- */
  // Cria o campo "key" de "obj" conforme a definição. onChange: avisa o bloco (ex.: atualizar o resumo).
  function renderField(obj, key, field, onChange) {
    switch (field.type) {
      case "list": return listField(obj, key, field, onChange);
      case "image": return imageField(obj, key, field, onChange);
    }
    var id = nextId(), wrap = el("div", field.type === "bool" ? "field check" : "field");
    var label = el("label", "", field.label);
    label.htmlFor = id;
    var input;
    if (field.type === "icon") {
      input = el("select");
      Object.keys(schema.icons).forEach(function (name) {
        input.append(new Option(schema.icons[name], name, false, obj[key] === name));
      });
    } else if (field.type === "bool") {
      input = el("input");
      input.type = "checkbox";
      input.checked = !!obj[key];
    } else {
      input = el(field.type === "textarea" ? "textarea" : "input");
      if (field.type === "textarea") input.rows = 3;
      input.maxLength = field.max;
      input.value = obj[key] || "";
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    input.id = id;
    input.addEventListener(field.type === "bool" || field.type === "icon" ? "change" : "input", function () {
      obj[key] = field.type === "bool" ? input.checked : input.value;
      touch();
      if (onChange) onChange();
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

  function imageField(obj, key, field, onChange) {
    var wrap = el("div", "field image-field"), labelId = nextId();
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-labelledby", labelId);
    var label = el("span", "field-label", field.label + (field.required ? " (obrigatória)" : ""));
    label.id = labelId;
    var m = obj[key] && media.get(obj[key]);
    var thumb = el("div", "img-thumb");
    if (m) {
      var img = el("img");
      img.src = m.url; img.alt = ""; img.width = m.width; img.height = m.height;
      var zoom = button("", "media-zoom", function () {
        Admin.viewImage({ url: m.url, alt: m.alt_text, title: m.original_name || field.label, width: m.width, height: m.height });
      }, "Ampliar imagem");
      zoom.append(img);
      thumb.append(zoom);
    } else {
      thumb.append(el("span", "muted small", obj[key] ? "Imagem não encontrada" : "Sem imagem"));
    }
    var replace = function (focusAction) {
      var fresh = imageField(obj, key, field, onChange);
      wrap.replaceWith(fresh);
      var target = fresh.querySelector('[data-action="' + focusAction + '"]') || fresh.querySelector("button");
      if (target) target.focus();
    };
    var pick = button(m ? "Trocar" : "Escolher imagem", "btn btn-sm btn-outline", async function () {
      var chosen = await Admin.pickImage({ currentId: obj[key] });
      if (!chosen) return;
      media.set(chosen.id, chosen);
      obj[key] = chosen.id;
      touch();
      if (onChange) onChange();
      replace("pick");
    });
    pick.dataset.action = "pick";
    var tools = el("div", "row-actions");
    tools.append(pick);
    if (obj[key]) {
      var remove = button("Remover", "btn btn-sm btn-danger", function () {
        obj[key] = null;
        touch();
        if (onChange) onChange();
        replace("pick");
      });
      tools.append(remove);
    }
    var side = el("div", "image-side");
    side.append(tools);
    if (m && !m.alt_text) side.append(el("p", "hint warn", "Sem texto alternativo: descreva esta imagem na página Imagens."));
    wrap.append(label, thumb, side);
    return wrap;
  }

  function listField(obj, key, field, onChange) {
    var items = obj[key];
    var box = el("fieldset", "list-field");
    var legend = el("legend", "", field.label + " (" + items.length + " de " + field.max + ")");
    box.append(legend);

    // Mudança de estrutura (adicionar/mover/remover): redesenha a lista e devolve o foco.
    var rerender = function (focusIndex, focusAction) {
      var fresh = listField(obj, key, field, onChange);
      box.replaceWith(fresh);
      touch();
      if (onChange) onChange();
      var cards = fresh.querySelectorAll(":scope > .list-item");
      var card = cards[Math.min(focusIndex, cards.length - 1)];
      // Mover: foco no mesmo botão (↑/↓). Adicionar/remover: foco no primeiro campo do item.
      var target = (card && focusAction && card.querySelector('[data-action="' + focusAction + '"]:not(:disabled)')) ||
        (card && card.querySelector(".field input, .field textarea, .field select, .field button")) ||
        fresh.querySelector(".add-item");
      if (target) target.focus();
    };

    items.forEach(function (item, i) {
      var card = el("div", "list-item");
      var head = el("div", "list-item-head");
      head.append(el("strong", "small", "Item " + (i + 1)));
      var tools = el("div", "tools");
      var up = button("↑", "icon-btn", function () {
        items.splice(i - 1, 0, items.splice(i, 1)[0]); rerender(i - 1, "up");
      }, "Mover item " + (i + 1) + " para cima");
      up.dataset.action = "up"; up.disabled = i === 0;
      var down = button("↓", "icon-btn", function () {
        items.splice(i + 1, 0, items.splice(i, 1)[0]); rerender(i + 1, "down");
      }, "Mover item " + (i + 1) + " para baixo");
      down.dataset.action = "down"; down.disabled = i === items.length - 1;
      var del = button("✕", "icon-btn danger", async function () {
        var hasContent = Object.keys(item).some(function (k) { return typeof item[k] === "string" ? item[k].trim() : false; });
        if (hasContent && !(await Admin.confirm({ title: "Remover o item " + (i + 1) + "?", text: "O texto deste item será perdido.", action: "Remover", danger: true }))) return;
        items.splice(i, 1); rerender(i, "remove");
      }, "Remover item " + (i + 1));
      del.dataset.action = "remove";
      tools.append(up, down, del);
      head.append(tools);
      card.append(head);
      Object.keys(field.item).forEach(function (k) { card.append(renderField(item, k, field.item[k], onChange)); });
      box.append(card);
    });

    var add = button("+ Adicionar item", "btn btn-sm btn-outline add-item", function () {
      items.push(newItem(field)); rerender(items.length - 1, "");
    });
    add.disabled = items.length >= field.max;
    box.append(add);
    return box;
  }

  /* ---------- Blocos ---------- */
  function renderBlock(block, index) {
    var def = schema.blocks[block.type];
    var li = el("li", "block");
    var bodyId = nextId(), isOpen = open.has(block);

    var head = el("div", "block-head");
    var toggle = button("", "block-toggle", function () {
      if (open.has(block)) open.delete(block); else open.add(block);
      var nowOpen = open.has(block);
      toggle.setAttribute("aria-expanded", String(nowOpen));
      body.hidden = !nowOpen;
    });
    toggle.dataset.action = "toggle";
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-controls", bodyId);
    var name = el("span", "block-name", (index + 1) + ". " + def.label);
    var sum = el("span", "block-summary muted");
    var refresh = function () { sum.textContent = summary(block); };
    refresh();
    toggle.append(name, sum);

    var tools = el("div", "tools");
    var label = def.label;
    var up = button("↑", "icon-btn", function () { move(index, -1, "up"); }, "Mover bloco " + (index + 1) + " (" + label + ") para cima");
    up.dataset.action = "up"; up.disabled = index === 0;
    var down = button("↓", "icon-btn", function () { move(index, 1, "down"); }, "Mover bloco " + (index + 1) + " (" + label + ") para baixo");
    down.dataset.action = "down"; down.disabled = index === sections.length - 1;
    var del = button("✕", "icon-btn danger", async function () {
      var ok = await Admin.confirm({
        title: "Remover o bloco “" + label + "”?",
        text: "O conteúdo deste bloco será perdido quando você salvar.",
        action: "Remover bloco", danger: true
      });
      if (!ok) return;
      sections.splice(index, 1);
      open.delete(block);
      touch();
      renderBlocks(Math.min(index, sections.length - 1), "toggle");
    }, "Remover bloco " + (index + 1) + " (" + label + ")");
    tools.append(up, down, del);
    head.append(toggle, tools);

    var body = el("div", "block-body");
    body.id = bodyId;
    body.hidden = !isOpen;
    if (def.help) body.append(el("p", "hint block-help", def.help));
    Object.keys(def.fields).forEach(function (k) { body.append(renderField(block, k, def.fields[k], refresh)); });

    li.append(head, body);
    return li;
  }

  function move(index, delta, action) {
    var to = index + delta;
    sections.splice(to, 0, sections.splice(index, 1)[0]);
    touch();
    renderBlocks(to, action);
  }

  // Redesenha a lista de blocos. focusIndex/focusAction: devolve o foco ao botão equivalente.
  function renderBlocks(focusIndex, focusAction) {
    list.replaceChildren.apply(list, sections.map(renderBlock));
    if (!sections.length) list.append(el("li", "empty muted", "Nenhum bloco. Use “Adicionar bloco”, abaixo."));
    $("add-block").disabled = sections.length >= schema.maxBlocks;
    if (focusIndex === undefined || focusIndex < 0) return;
    var li = list.children[focusIndex];
    var target = li && (li.querySelector('[data-action="' + focusAction + '"]:not(:disabled)') || li.querySelector(".block-toggle"));
    if (target) target.focus();
  }

  function openBlock(index) {
    var block = sections[index];
    if (!block) return;
    open.add(block);
    renderBlocks(index, "toggle");
    list.children[index].scrollIntoView({ block: "start", behavior: "smooth" });
  }

  /* ---------- Publicação ---------- */
  var published = function () { return form.elements.published.value === "yes"; };

  function updatePublishHint() {
    var hint = $("pub-hint"), live = published();
    var savedLive = !!(page && page.published_at);
    var text = !live ? "Só você vê, pela pré-visualização."
      : product.status !== "published"
        ? "Atenção: o produto está como “" + Admin.STATUS[product.status] + "”. A página só aparece para o público quando o produto também estiver publicado."
        : "Visível para o público em /p/" + product.slug + ".";
    var pending = page ? live !== savedLive : live;
    hint.textContent = text + (pending ? " Salve para aplicar." : "");
    hint.classList.toggle("warn", pending || (live && product.status !== "published"));
  }

  function updateLinks() {
    $("preview-link").hidden = !page;
    $("preview-link").href = "/admin/preview/" + encodeURIComponent(productId);
    var live = !!(page && page.published_at && product.status === "published");
    $("public-link").hidden = !live;
    $("public-link").href = "/p/" + encodeURIComponent(product.slug);
  }

  function showEditor(data) {
    sections = data;
    $("start").hidden = true;
    form.hidden = false;
    renderBlocks();
    updatePublishHint();
  }

  /* ---------- Eventos ---------- */
  $("start-default").addEventListener("click", function () {
    showEditor(copy(schema.defaultSections));
    dirty = true;
    openBlock(0);
    Admin.showMessage(msg, "Modelo padrão carregado. Substitua os textos de orientação e salve.", "success");
  });
  $("start-blank").addEventListener("click", function () {
    showEditor([]);
    dirty = true;
    $("new-type").focus();
  });

  $("add-block").addEventListener("click", function () {
    var type = $("new-type").value;
    var block = newBlock(type);
    sections.push(block);
    open.add(block);
    touch();
    renderBlocks(sections.length - 1, "toggle");
    list.lastElementChild.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  form.addEventListener("change", function (e) { if (e.target.name === "published") touch(); });
  $("seo_title").addEventListener("input", touch);
  $("seo_description").addEventListener("input", touch);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var saveBtn = $("save");
    saveBtn.disabled = true;
    Admin.showMessage(msg, "Salvando…");
    try {
      var openIndexes = sections.map(function (b, i) { return open.has(b) ? i : -1; }).filter(function (i) { return i >= 0; });
      page = await Admin.api("/products/" + encodeURIComponent(productId) + "/sales-page", {
        method: "PUT",
        body: {
          sections: sections,
          seo_title: $("seo_title").value,
          seo_description: $("seo_description").value,
          published: published()
        }
      });
      // A resposta traz os blocos como foram gravados (textos aparados etc.); reabre os mesmos blocos.
      sections = page.sections;
      open = new Set(openIndexes.map(function (i) { return sections[i]; }).filter(Boolean));
      dirty = false;
      renderBlocks();
      updateLinks();
      updatePublishHint();
      Admin.showMessage(msg, "Página salva às " + new Date().toLocaleTimeString("pt-BR") + ".", "success");
    } catch (err) {
      var text = err.status === 401
        ? "Sua sessão expirou. Entre novamente em outra aba e clique em Salvar de novo (os dados desta tela foram mantidos)."
        : err.message;
      Admin.showMessage(msg, text, "error");
      var where = /^Bloco (\d+)/.exec(err.message || ""); // "Bloco 3 (FAQ) › ..." -> abre o bloco 3
      if (where) openBlock(Number(where[1]) - 1);
    } finally {
      saveBtn.disabled = false;
    }
  });

  /* ---------- Carregamento ---------- */
  (async function () {
    var loadMsg = $("load-msg");
    try {
      await Admin.requireSession();
      if (!productId) throw new Error("Produto não informado.");
      var results = await Promise.all([
        Admin.api("/products/" + encodeURIComponent(productId)),
        Admin.api("/products/" + encodeURIComponent(productId) + "/sales-page"),
        Admin.api("/sales-blocks"),
        Admin.api("/media")
      ]);
      product = results[0]; page = results[1]; schema = results[2];
      results[3].forEach(function (m) { media.set(m.id, m); });

      document.title = "Página de vendas: " + product.title + " — Painel administrativo";
      $("product-name").textContent = product.title;
      $("back").href = $("cancel").href = "produto.html?id=" + encodeURIComponent(productId);
      Object.keys(schema.blocks).forEach(function (type) {
        $("new-type").append(new Option(schema.blocks[type].label, type));
      });
      updateLinks();
      loadMsg.hidden = true;

      if (!page) { $("start").hidden = false; return; }
      $("seo_title").value = page.seo_title || "";
      $("seo_description").value = page.seo_description || "";
      form.elements.published.value = page.published_at ? "yes" : "no";
      showEditor(page.sections);
    } catch (err) {
      Admin.showMessage(loadMsg, err.message, "error");
    }
  })();
})();
