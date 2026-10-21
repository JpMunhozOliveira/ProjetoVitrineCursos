/* Biblioteca de imagens: enviar, descrever (texto alternativo), ver onde é usada e excluir. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var msg = $("msg"), list = $("library"), onlyUnused = $("only-unused");
  var all = [];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function card(m) {
    var li = el("li", "media-card");
    var name = m.original_name || "Imagem sem nome";

    var img = el("img");
    img.src = m.url; img.alt = m.alt_text || ""; img.loading = "lazy"; img.width = m.width; img.height = m.height;

    var body = el("div", "media-body");
    body.append(el("strong", "media-name", name));
    body.append(el("span", "muted small",
      m.width + "×" + m.height + " · " + Admin.formatBytes(m.size_bytes) + " · " +
      new Date(m.created_at).toLocaleDateString("pt-BR")));

    // Onde a imagem é usada (links para os produtos) ou aviso de "sem uso".
    var usage = el("p", "media-usage small");
    var KIND = { cover: "capa de ", brand: "logo da marca de ", page: "página de vendas de " };
    if (m.usage.length) {
      usage.append("Usada em: ");
      m.usage.forEach(function (u, i) {
        if (i) usage.append("; ");
        usage.append(KIND[u.kind] || "");
        var a = el("a", "", u.title);
        a.href = "produto.html?id=" + encodeURIComponent(u.id);
        usage.append(a);
      });
    } else {
      usage.append(el("span", "badge", "Sem uso"));
    }
    body.append(usage);

    // Texto alternativo editável.
    var altId = "alt-" + m.id;
    var field = el("div", "field");
    var label = el("label", "", "Texto alternativo");
    label.htmlFor = altId;
    var input = el("input");
    input.id = altId; input.maxLength = 300; input.value = m.alt_text || "";
    input.placeholder = "Descreva a imagem";
    field.append(label, input);
    body.append(field);

    var actions = el("div", "row-actions");
    var save = el("button", "btn btn-sm btn-outline", "Salvar texto");
    save.type = "button";
    save.addEventListener("click", async function () {
      save.disabled = true;
      try {
        var updated = await Admin.api("/media/" + m.id, { method: "PATCH", body: { alt_text: input.value.trim() || null } });
        m.alt_text = updated.alt_text;
        input.value = m.alt_text || "";
        img.alt = m.alt_text || "";
        Admin.showMessage(msg, "Texto alternativo de “" + name + "” salvo.", "success");
      } catch (err) {
        Admin.showMessage(msg, err.message, "error");
      } finally {
        save.disabled = false;
      }
    });
    actions.append(save);

    // Imagem em uso não pode ser excluída (regra da API); o botão nem aparece.
    if (!m.usage.length) {
      var del = el("button", "btn btn-sm btn-danger", "Excluir");
      del.type = "button";
      del.setAttribute("aria-label", "Excluir " + name);
      del.addEventListener("click", async function () {
        var ok = await Admin.confirm({
          title: "Excluir “" + name + "”?",
          text: "O arquivo será apagado definitivamente.",
          action: "Excluir definitivamente",
          danger: true
        });
        if (!ok) return;
        try {
          await Admin.api("/media/" + m.id, { method: "DELETE" });
          await load();
          Admin.showMessage(msg, "“" + name + "” foi excluída.", "success");
        } catch (err) {
          Admin.showMessage(msg, err.message, "error");
        }
      });
      actions.append(del);
    }
    body.append(actions);

    // Miniatura clicável: abre a imagem inteira.
    var zoom = el("button", "media-zoom");
    zoom.type = "button";
    zoom.setAttribute("aria-label", "Ampliar " + name);
    zoom.append(img);
    zoom.addEventListener("click", function () {
      Admin.viewImage({ url: m.url, alt: m.alt_text, title: name, width: m.width, height: m.height });
    });

    li.append(zoom, body);
    return li;
  }

  function render() {
    var unused = all.filter(function (m) { return !m.usage.length; });
    var shown = onlyUnused.checked ? unused : all;
    list.replaceChildren.apply(list, shown.map(card));

    $("toolbar").hidden = !all.length;
    $("summary").textContent = all.length + " imagem(ns) · " + unused.length + " sem uso";
    var empty = !all.length ? "Nenhuma imagem enviada ainda."
      : !shown.length ? "Todas as imagens estão em uso." : "";
    $("empty").textContent = empty;
    $("empty").hidden = !empty;
  }

  async function load() {
    all = await Admin.api("/media");
    render();
  }

  onlyUnused.addEventListener("change", render);

  // Vários arquivos de uma vez: envia um por vez e informa o resultado de cada um.
  $("upload").addEventListener("change", async function () {
    var files = Array.prototype.slice.call(this.files);
    this.value = "";
    if (!files.length) return;
    var sent = 0, errors = [];
    for (var i = 0; i < files.length; i++) {
      Admin.showMessage(msg, "Enviando " + (i + 1) + " de " + files.length + ": “" + files[i].name + "”…");
      try { await Admin.uploadImage(files[i]); sent++; } catch (err) { errors.push(err.message); }
    }
    await load();
    if (errors.length) {
      Admin.showMessage(msg, (sent ? sent + " enviada(s). " : "") + "Não enviadas: " + errors.join(" "), "error");
    } else {
      Admin.showMessage(msg, sent + " imagem(ns) enviada(s). Preencha o texto alternativo de cada uma.", "success");
    }
  });

  (async function () {
    try {
      await Admin.requireSession();
      await load();
      Admin.showMessage(msg, "");
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    }
  })();
})();
