/* Biblioteca de imagens: enviar, renomear, descrever (texto alternativo, na imagem ampliada),
   ver onde é usada e excluir. */
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

  var KIND = { cover: "Capa de ", brand: "Logo da empresa ", "brand-icon": "Ícone da aba da empresa ", page: "Página de vendas de ", shared: "Bloco salvo " };

  // Nome: clicar transforma em campo. Enter ou sair do campo salva; Esc desiste.
  function nameEditor(m) {
    var box = el("div", "media-name-box");
    var show = el("button", "media-name");
    show.type = "button";
    function paint() {
      show.replaceChildren(el("span", "media-name-text", m.original_name || "Imagem sem nome"), el("span", "media-name-pen", "✎"));
      show.lastChild.setAttribute("aria-hidden", "true");
      show.setAttribute("aria-label", "Renomear " + (m.original_name || "imagem sem nome"));
      show.title = "Renomear";
    }
    paint();
    show.addEventListener("click", function () {
      var input = el("input", "media-name-input");
      input.value = m.original_name || ""; input.maxLength = 255;
      input.setAttribute("aria-label", "Novo nome da imagem");
      var done = false;
      async function finish(save) {
        if (done) return;
        done = true;
        var next = input.value.trim();
        if (save && next && next !== m.original_name) {
          input.disabled = true;
          try {
            var updated = await Admin.api("/media/" + m.id, { method: "PATCH", body: { original_name: next } });
            m.original_name = updated.original_name;
            Admin.showMessage(msg, "Imagem renomeada para “" + m.original_name + "”.", "success");
          } catch (err) {
            Admin.showMessage(msg, err.message, "error");
          }
        } else if (save && !next) {
          Admin.showMessage(msg, "O nome não pode ficar vazio. O nome anterior foi mantido.", "error");
        }
        paint();
        input.replaceWith(show);
        show.focus();
      }
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
      });
      input.addEventListener("blur", function () { finish(true); });
      show.replaceWith(input);
      input.focus();
      input.select();
    });
    box.append(show);
    return box;
  }

  // "Usada em X lugares" com a lista num balão (Admin.usagePopover, em common.js).
  function usageSummary(m) {
    if (!m.usage.length) return el("span", "badge", "Sem uso");
    return Admin.usagePopover(m.usage.map(function (u) {
      return {
        label: KIND[u.kind] || "", title: u.title,
        href: u.kind.indexOf("brand") === 0 ? "empresas.html#" + encodeURIComponent(u.id)
          : u.kind === "shared" ? "blocos.html" : "produto.html?id=" + encodeURIComponent(u.id)
      };
    }), { prefix: "Usada em", one: "lugar", many: "lugares" });
  }

  function card(m) {
    var li = el("li", "media-card");
    var name = function () { return m.original_name || "Imagem sem nome"; };

    var img = el("img");
    img.src = m.url; img.alt = m.alt_text || ""; img.loading = "lazy"; img.width = m.width; img.height = m.height;

    var body = el("div", "media-body");
    body.append(nameEditor(m));
    body.append(el("span", "muted small",
      m.width + "×" + m.height + " · " + Admin.formatBytes(m.size_bytes) + " · " +
      new Date(m.created_at).toLocaleDateString("pt-BR")));

    // Linha dos selos: selos à esquerda (quebram linha se precisar) e o "×" de excluir fixo à direita.
    var tags = el("div", "media-tags"), badges = el("div", "media-badges");
    tags.append(badges);
    badges.append(usageSummary(m));
    var noAlt = el("span", "badge badge-alt", "Sem texto alternativo");
    noAlt.title = "Clique na imagem para escrever o texto alternativo";
    noAlt.hidden = !!m.alt_text;
    badges.append(noAlt);
    body.append(tags);

    // Imagem em uso não pode ser excluída (regra da API); o botão nem aparece.
    if (!m.usage.length) {
      // Um "×" no fim da linha dos selos (à direita).
      var del = el("button", "media-delete", "×");
      del.type = "button";
      del.title = "Excluir";
      del.setAttribute("aria-label", "Excluir " + name());
      del.addEventListener("click", async function () {
        var ok = await Admin.confirm({
          title: "Excluir “" + name() + "”?",
          text: "O arquivo será apagado definitivamente.",
          action: "Excluir definitivamente",
          danger: true
        });
        if (!ok) return;
        try {
          await Admin.api("/media/" + m.id, { method: "DELETE" });
          await load();
          Admin.showMessage(msg, "“" + name() + "” foi excluída.", "success");
        } catch (err) {
          Admin.showMessage(msg, err.message, "error");
        }
      });
      tags.append(del);
    }

    // Miniatura clicável: abre a imagem inteira, com o texto alternativo editável embaixo.
    var zoom = el("button", "media-zoom");
    zoom.type = "button";
    zoom.setAttribute("aria-label", "Ampliar " + name() + " e editar o texto alternativo");
    zoom.append(img);
    zoom.addEventListener("click", function () {
      Admin.viewImage({
        url: m.url, alt: m.alt_text, title: name(), width: m.width, height: m.height,
        onSaveAlt: async function (text) {
          var updated = await Admin.api("/media/" + m.id, { method: "PATCH", body: { alt_text: text } });
          m.alt_text = updated.alt_text;
          img.alt = m.alt_text || "";
          noAlt.hidden = !!m.alt_text;
          return m.alt_text;
        }
      });
    });

    li.append(zoom, body);
    return li;
  }

  // Texto pesquisável: nome, texto alternativo e os lugares onde a imagem é usada.
  function searchText(m) {
    return [m.original_name, m.alt_text].concat(m.usage.map(function (u) { return u.title; })).join(" ");
  }

  function render() {
    var unused = all.filter(function (m) { return !m.usage.length; });
    var base = onlyUnused.checked ? unused : all;
    var query = $("q").value.trim();
    var shown = Admin.searchFilter(base, query, searchText);
    list.replaceChildren.apply(list, shown.map(card));

    $("search").hidden = !all.length;
    $("count").textContent = query ? shown.length + " de " + base.length + " imagem(ns)" : "";
    $("toolbar").hidden = !all.length;
    $("summary").textContent = all.length + " imagem(ns) · " + unused.length + " sem uso";
    var empty = !all.length ? "Nenhuma imagem enviada ainda."
      : !shown.length && query ? "Nenhuma imagem encontrada para “" + query + "”."
      : !shown.length ? "Todas as imagens estão em uso." : "";
    $("empty").textContent = empty;
    $("empty").hidden = !empty;
  }

  async function load() {
    all = await Admin.api("/media");
    render();
  }

  onlyUnused.addEventListener("change", render);
  $("q").addEventListener("input", render);

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
      Admin.showMessage(msg, sent + " imagem(ns) enviada(s). Clique em cada imagem para escrever o texto alternativo.", "success");
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
