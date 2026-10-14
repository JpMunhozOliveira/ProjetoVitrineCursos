/* Formulário de produto: cria (produto.html) ou edita (produto.html?id=...). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var form = $("product-form"), msg = $("msg"), saveBtn = $("save");
  var id = new URLSearchParams(location.search).get("id");
  var dirty = false;      // há alterações não salvas?
  var slugTouched = !!id; // na criação, o slug acompanha o título até ser editado à mão
  var savedStatus = null; // situação como está gravada no banco (null = produto ainda não criado)

  var STATUS_HINTS = {
    draft: "Não aparece no site.",
    published: "Visível no site para os visitantes.",
    archived: "Oculto do site; pode ser publicado de novo."
  };

  Admin.hasUnsavedChanges = function () { return dirty; };

  // Campos de texto enviados como estão; a API apara espaços e transforma vazio em null.
  var TEXT_FIELDS = ["title", "slug", "status", "category", "short_description", "description",
    "audience", "prerequisites", "format", "workload", "checkout_url"];

  // "Manual Prático!" -> "manual-pratico"
  function slugify(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").slice(0, 180).replace(/^-+|-+$/g, "");
  }

  // Converte o texto digitado em centavos sem passar por número decimal (evita 19.99 * 100 = 1998.9999...).
  // Aceita "197", "197,9", "1.234,56" e "1234.56". Vazio -> null; formato inválido -> NaN.
  function parsePrice(text) {
    var s = text.replace(/\s|R\$/g, "");
    if (!s) return null;
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", "."); // formato brasileiro
    var m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
    if (!m) return NaN;
    return Number(m[1]) * 100 + Number((m[2] || "").padEnd(2, "0"));
  }

  function priceToInput(cents) {
    if (cents === null || cents === undefined) return "";
    return Math.floor(cents / 100) + "," + String(cents % 100).padStart(2, "0");
  }

  function fill(p) {
    TEXT_FIELDS.forEach(function (f) { form.elements[f].value = p[f] || ""; });
    form.elements.featured.checked = !!p.featured;
    form.elements.modules.value = (p.modules || []).join("\n");
    form.elements.price.value = priceToInput(p.price_cents);
    showCover(p.image || null);
  }

  function collect() {
    var data = {};
    TEXT_FIELDS.forEach(function (f) { data[f] = form.elements[f].value; });
    data.featured = form.elements.featured.checked;
    data.modules = form.elements.modules.value.split("\n"); // linhas vazias são descartadas pela API
    data.price_cents = parsePrice(form.elements.price.value);
    data.image_id = cover ? cover.id : null;
    return data;
  }

  /* ---------- Imagem de capa ----------
     A imagem é enviada para a biblioteca na hora (gera um registro em /media), mas só vira capa
     do produto quando ele é salvo. Se você desistir, ela fica na biblioteca e pode ser excluída lá. */
  var cover = null; // { id, url, alt_text, width, height } ou null

  function showCover(image) {
    cover = image;
    var img = $("cover-img");
    $("cover-zoom").hidden = !image;
    $("cover-empty").hidden = !!image;
    if (image) {
      img.src = image.url;
      img.width = image.width; img.height = image.height; // reserva o espaço antes de carregar
    } else {
      img.removeAttribute("src");
    }
    $("cover-remove").hidden = !image;
    $("cover-alt-field").hidden = !image;
    $("cover-alt").value = image ? image.alt_text || "" : "";
  }

  function chooseCover(image, text) {
    showCover(image);
    dirty = true;
    Admin.showMessage($("cover-msg"), text, "success");
  }

  $("cover-file").addEventListener("change", async function () {
    var file = this.files[0];
    this.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    var coverMsg = $("cover-msg");
    Admin.showMessage(coverMsg, "Enviando “" + file.name + "”…");
    try {
      chooseCover(await Admin.uploadImage(file), "Imagem enviada. Clique em Salvar para aplicá-la ao produto.");
      $("cover-alt").focus(); // próximo passo natural: descrever a imagem
    } catch (err) {
      Admin.showMessage(coverMsg, err.message, "error");
    }
  });

  $("cover-zoom").addEventListener("click", function () {
    if (!cover) return;
    Admin.viewImage({
      url: cover.url, alt: $("cover-alt").value.trim(), title: "Imagem de capa",
      width: cover.width, height: cover.height
    });
  });

  $("cover-remove").addEventListener("click", function () {
    chooseCover(null, "Capa removida. Clique em Salvar para aplicar (a imagem continua na biblioteca).");
  });

  // Seletor de imagens da biblioteca (compartilhado: Admin.pickImage, em common.js).
  $("cover-pick").addEventListener("click", async function () {
    var m = await Admin.pickImage({ currentId: cover && cover.id });
    if (m) chooseCover(m, "Imagem escolhida. Clique em Salvar para aplicá-la ao produto.");
  });

  // O texto alternativo pertence à imagem (fica na biblioteca); é gravado junto com o produto.
  async function saveCoverAlt() {
    if (!cover) return;
    var alt = $("cover-alt").value.trim();
    if (alt === (cover.alt_text || "")) return;
    var updated = await Admin.api("/media/" + encodeURIComponent(cover.id), { method: "PATCH", body: { alt_text: alt || null } });
    cover.alt_text = updated.alt_text;
  }

  // Ajusta a tela ao produto como está GRAVADO (não ao que foi alterado e ainda não salvo).
  function setMode(product) {
    var title = product ? "Editar produto" : "Novo produto";
    $("heading").textContent = title;
    document.title = title + " — Painel administrativo";
    $("slug-hint").hidden = !product;
    savedStatus = product ? product.status : null;
    updateStatusHint();

    // Mesma regra da API: publicado precisa ser arquivado antes de poder ser excluído.
    $("danger").hidden = !product;
    if (!product) return;
    var published = product.status === "published";
    $("danger-text").textContent = published
      ? "Produtos publicados não podem ser excluídos. Para tirá-lo do site, escolha “Arquivado” na barra de situação, ao lado do Salvar, e salve."
      : "A exclusão é permanente: o produto e a página de vendas dele serão apagados.";
    $("delete").hidden = published;
    refreshSalesZone(product);
  }

  // Área "Página de vendas": situação da página e links para pré-visualizar / ver publicada.
  // A página só é pública com o produto publicado E a página publicada.
  async function refreshSalesZone(product) {
    var zone = $("sales"), status = $("sales-status"), preview = $("sales-preview"), pub = $("sales-public");
    zone.hidden = !product;
    if (!product) return;
    try {
      var page = await Admin.api("/products/" + encodeURIComponent(product.id) + "/sales-page");
      preview.hidden = !page;
      preview.href = "/admin/preview/" + encodeURIComponent(product.id);
      var live = !!(page && page.published_at && product.status === "published");
      pub.hidden = !live;
      pub.href = "/p/" + encodeURIComponent(product.slug);
      var edit = $("sales-edit");
      edit.hidden = false;
      edit.href = "pagina.html?id=" + encodeURIComponent(product.id);
      edit.textContent = page ? "Editar página de vendas" : "Criar página de vendas";
      status.textContent = !page ? "Este produto ainda não tem página de vendas. Use “Criar página de vendas”, no topo."
        : live ? "Publicada em /p/" + product.slug + "."
        : page.published_at ? "A página está publicada, mas o produto não: ela só aparece para o público quando o produto também estiver publicado."
        : "Criada, ainda não publicada. Use a pré-visualização para conferir.";
    } catch (err) {
      status.textContent = err.message;
    }
  }

  $("delete").addEventListener("click", async function () {
    var name = form.elements.title.value || "este produto";
    var ok = await Admin.confirm({
      title: "Excluir “" + name + "”?",
      text: "Esta ação é permanente: o produto e a página de vendas dele serão apagados.",
      action: "Excluir definitivamente",
      danger: true
    });
    if (!ok) return;
    try {
      await Admin.api("/products/" + encodeURIComponent(id), { method: "DELETE" });
      dirty = false; // não pergunta sobre "alterações não salvas" de um produto que não existe mais
      Admin.setFlash("“" + name + "” foi excluído.");
      location.replace("./");
    } catch (err) {
      Admin.showMessage($("danger-msg"), err.message, "error");
    }
  });

  form.elements.title.addEventListener("input", function () {
    if (!slugTouched) form.elements.slug.value = slugify(form.elements.title.value);
  });
  form.elements.slug.addEventListener("input", function () {
    slugTouched = form.elements.slug.value !== ""; // apagou tudo? volta a acompanhar o título
  });
  form.elements.price.addEventListener("input", function () { form.elements.price.setCustomValidity(""); });
  // Explica a situação escolhida e avisa quando ela ainda não foi gravada.
  function updateStatusHint() {
    var chosen = form.elements.status.value;
    var pending = savedStatus && chosen !== savedStatus;
    var hint = $("status-hint");
    hint.textContent = STATUS_HINTS[chosen] +
      (pending ? " Hoje está como “" + Admin.STATUS[savedStatus] + "”: salve para aplicar." : "");
    hint.classList.toggle("warn", !!pending);
  }

  form.addEventListener("input", function () { dirty = true; });
  form.addEventListener("change", function (e) { if (e.target.name === "status") updateStatusHint(); });

  window.addEventListener("beforeunload", function (e) {
    if (dirty && !Admin.leaving) { e.preventDefault(); e.returnValue = ""; }
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var data = collect();
    if (Number.isNaN(data.price_cents)) {
      form.elements.price.setCustomValidity("Use o formato 197,00 (ou deixe vazio para ocultar o preço).");
    }
    if (!form.reportValidity()) return; // validação do navegador: obrigatórios, tamanhos e formatos

    saveBtn.disabled = true;
    Admin.showMessage(msg, "Salvando…");
    try {
      await saveCoverAlt();
      var saved = id
        ? await Admin.api("/products/" + encodeURIComponent(id), { method: "PATCH", body: data })
        : await Admin.api("/products", { method: "POST", body: data });

      if (!id) {
        id = saved.id; slugTouched = true;
        history.replaceState(null, "", "produto.html?id=" + encodeURIComponent(id));
      }
      fill(saved); // mostra os valores como ficaram gravados (ex.: espaços removidos, link normalizado)
      Admin.showMessage($("cover-msg"), ""); // o aviso "clique em Salvar" já foi atendido
      setMode(saved);
      dirty = false;
      Admin.showMessage(msg, "Produto salvo às " + new Date().toLocaleTimeString("pt-BR") + ".", "success");
    } catch (err) {
      var text = err.status === 401
        ? "Sua sessão expirou. Entre novamente em outra aba e clique em Salvar de novo (os dados desta tela foram mantidos)."
        : err.message;
      Admin.showMessage(msg, text, "error");
      if (err.status === 409) form.elements.slug.focus();
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Carregamento inicial: a mensagem fica fora do formulário, que só aparece se tudo der certo.
  (async function () {
    var loadMsg = $("load-msg");
    try {
      await Admin.requireSession();
      if (id) {
        var product = await Admin.api("/products/" + encodeURIComponent(id));
        fill(product);
        setMode(product);
      } else {
        setMode(null);
      }
      form.hidden = false;
      loadMsg.hidden = true;
    } catch (err) {
      Admin.showMessage(loadMsg, err.message, "error");
    }
  })();
})();
