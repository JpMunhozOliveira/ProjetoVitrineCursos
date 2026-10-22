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
  var TEXT_FIELDS = ["title", "slug", "status", "category", "area", "short_description",
    "format", "workload", "checkout_url"];

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
    // Categoria antiga fora da lista fixa: o seletor fica em "Sem categoria".
    if (form.elements.category.selectedIndex < 0) form.elements.category.value = "";
    form.elements.featured.checked = !!p.featured;
    form.elements.price.value = priceToInput(p.price_cents);
    cover.show(p.image || null);
    brand.select(p.brand_id || "");
    kiwify.setSaved(p);
  }

  function collect() {
    var data = {};
    TEXT_FIELDS.forEach(function (f) { data[f] = form.elements[f].value; });
    data.featured = form.elements.featured.checked;
    data.price_cents = parsePrice(form.elements.price.value);
    data.image_id = cover.image ? cover.image.id : null;
    data.brand_id = form.elements.brand_id.value || null;
    Object.assign(data, kiwify.collect());
    return data;
  }

  var cover = Admin.imageField("cover", {
    title: "Imagem de capa", removed: "Capa removida.",
    apply: "Clique em Salvar para aplicá-la ao produto.",
    hint: "Tamanho recomendado: 1200 × 675 px (formato 16:9)."
  }, function () { dirty = true; });

  /* ---------- Empresa (cadastrada na aba Empresas) ----------
     O produto guarda só qual empresa é; nome e logo vêm do cadastro dela. Assim, trocar o logo ou o
     nome na aba Empresas muda todos os produtos dela de uma vez. */
  var brand = (function () {
    var select = form.elements.brand_id, brands = [];

    function label(b) {
      return b.name || ("Só logo" + (b.logo && (b.logo.alt_text || b.logo.original_name) ? " — " + (b.logo.alt_text || b.logo.original_name) : ""));
    }

    // Pré-visualização como no menu da página de vendas: logo e/ou nome sobre fundo escuro.
    function preview() {
      var b = brands.find(function (x) { return x.id === select.value; });
      var img = $("brand-img"), name = $("brand-name-preview");
      img.hidden = !(b && b.logo);
      if (b && b.logo) {
        img.src = b.logo.url; img.width = b.logo.width; img.height = b.logo.height;
        img.alt = b.name ? "" : b.logo.alt_text || "";
      } else {
        img.removeAttribute("src");
      }
      name.textContent = b ? b.name || "" : "Marca do site";
      name.classList.toggle("muted", !b);
      $("brand-usage").textContent = b && b.usage.length > 1
        ? "Usada em " + b.usage.length + " produtos: alterações na aba Empresas valem para todos eles." : "";
    }

    function current() {
      return brands.find(function (x) { return x.id === select.value; }) || null;
    }

    function draw(current) {
      var none = document.createElement("option");
      none.value = ""; none.textContent = "Marca do site (padrão)";
      var options = brands.map(function (b) {
        var o = document.createElement("option");
        o.value = b.id; o.textContent = label(b);
        return o;
      });
      select.replaceChildren.apply(select, [none].concat(options));
      select.value = current;
      preview();
    }

    select.addEventListener("change", function () { preview(); kiwify.brandChanged(); });
    return {
      load: async function () { brands = await Admin.api("/brands"); draw(select.value); },
      select: function (id) { draw(id); },
      current: current
    };
  })();

  /* ---------- Kiwify: preço e link vindos da conta Kiwify da empresa ----------
     Com a empresa conectada (aba Empresas), escolhe-se o produto e o link de checkout da Kiwify; o
     preço e o link ficam travados e se atualizam sozinhos (no servidor, a cada 6 h). */
  var kiwify = (function () {
    var box = $("kiwify-link"), prodSel = $("kiwify_product"), linkSel = $("kiwify_link");
    var info = $("kiwify-info"), kmsg = $("kiwify-msg"), refresh = $("kiwify-refresh");
    var saved = null;      // vínculo como está gravado: { brand, product, link, synced, error }
    var listBrand = null;  // empresa cuja lista de produtos está no seletor
    var links = [];        // links do produto escolhido
    var run = 0;           // descarta respostas atrasadas quando a escolha muda no meio do caminho

    function option(value, text) {
      var o = document.createElement("option");
      o.value = value; o.textContent = text;
      return o;
    }
    function lock(on) {
      form.elements.price.readOnly = on;
      form.elements.checkout_url.readOnly = on;
    }
    // Preço e link do link escolhido aparecem nos campos (o servidor confirma ao salvar).
    function applyLink() {
      var l = links.find(function (x) { return x.id === linkSel.value; });
      if (!l) return;
      form.elements.price.value = priceToInput(l.price_cents);
      form.elements.price.setCustomValidity("");
      form.elements.checkout_url.value = l.checkout_url;
    }
    function isSavedChoice() {
      return !!(saved && saved.brand === form.elements.brand_id.value
        && prodSel.value === saved.product && linkSel.value === saved.link);
    }
    function updateInfo() {
      var linked = !!prodSel.value;
      lock(linked);
      refresh.hidden = !isSavedChoice();
      if (!linked) { info.textContent = ""; return; }
      if (!isSavedChoice()) { info.textContent = "Preço e link virão da Kiwify. Clique em Salvar para aplicar."; return; }
      info.textContent = "Preço e link vindos da Kiwify" + (saved.synced ? ", atualizados em " +
        new Date(saved.synced).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "") + ".";
      if (saved.error) Admin.showMessage(kmsg, "Última atualização falhou: " + saved.error + " O site mantém o último preço e link.", "error");
    }

    async function loadLinks(wanted) {
      var mine = ++run;
      links = [];
      linkSel.replaceChildren();
      linkSel.disabled = true;
      if (!prodSel.value) { updateInfo(); return; }
      linkSel.append(option("", "Carregando…"));
      try {
        var p = await Admin.api("/brands/" + encodeURIComponent(listBrand) + "/kiwify/products/" + encodeURIComponent(prodSel.value));
        if (mine !== run) return;
        links = (p.links || []).filter(function (l) { return l.status === "active" || l.id === wanted; });
        linkSel.replaceChildren.apply(linkSel, links.map(function (l) {
          return option(l.id, l.name + " — " + Admin.formatPrice(l.price_cents) + (l.status === "active" ? "" : " (desativado)"));
        }));
        if (!links.length) {
          linkSel.append(option("", "Nenhum link ativo neste produto"));
          Admin.showMessage(kmsg, "Este produto não tem link de checkout ativo na Kiwify.", "error");
        } else {
          linkSel.disabled = false;
          linkSel.value = links.some(function (l) { return l.id === wanted; }) ? wanted : links[0].id;
          if (!isSavedChoice()) applyLink();
        }
      } catch (err) {
        if (mine !== run) return;
        linkSel.replaceChildren(option(wanted || "", wanted ? "Link vinculado (" + wanted + ")" : "—"));
        Admin.showMessage(kmsg, err.message, "error");
      }
      updateInfo();
    }

    // Mostra o seletor quando a empresa escolhida tem conta Kiwify e carrega os produtos dela.
    async function draw() {
      var b = brand.current();
      Admin.showMessage(kmsg, "");
      box.hidden = !(b && b.kiwify);
      if (box.hidden) {
        run++;
        listBrand = null;
        prodSel.replaceChildren(option("", "Não vincular (preencher à mão)"));
        links = []; linkSel.replaceChildren(); linkSel.disabled = true;
        lock(false); refresh.hidden = true; info.textContent = "";
        return;
      }
      var keep = saved && saved.brand === b.id ? saved : null;
      if (listBrand !== b.id) {
        listBrand = b.id;
        var mine = ++run;
        prodSel.replaceChildren(option("", "Carregando produtos da Kiwify…"));
        linkSel.replaceChildren(); linkSel.disabled = true;
        try {
          var list = await Admin.api("/brands/" + encodeURIComponent(b.id) + "/kiwify/products");
          if (mine !== run) return;
          prodSel.replaceChildren.apply(prodSel, [option("", "Não vincular (preencher à mão)")].concat(list.map(function (p) {
            return option(p.id, p.name + (p.status && p.status !== "active" ? " (inativo)" : ""));
          })));
        } catch (err) {
          if (mine !== run) return;
          prodSel.replaceChildren(option("", "Não vincular (preencher à mão)"));
          Admin.showMessage(kmsg, err.message, "error");
        }
        if (keep && !Array.prototype.some.call(prodSel.options, function (o) { return o.value === keep.product; })) {
          prodSel.append(option(keep.product, "Produto vinculado (" + keep.product + ")"));
        }
      }
      prodSel.value = keep ? keep.product : "";
      await loadLinks(keep ? keep.link : "");
    }

    prodSel.addEventListener("change", function () { Admin.showMessage(kmsg, ""); loadLinks(""); });
    linkSel.addEventListener("change", function () { applyLink(); updateInfo(); });

    refresh.addEventListener("click", async function () {
      refresh.disabled = true;
      Admin.showMessage(kmsg, "Consultando a Kiwify…");
      try {
        var p = await Admin.api("/products/" + encodeURIComponent(id) + "/kiwify-sync", { method: "POST" });
        form.elements.price.value = priceToInput(p.price_cents);
        form.elements.checkout_url.value = p.checkout_url || "";
        saved.synced = p.kiwify_synced_at; saved.error = p.kiwify_sync_error;
        updateInfo();
        Admin.showMessage(kmsg, "Preço e link atualizados: " + Admin.formatPrice(p.price_cents) + ".", "success");
      } catch (err) {
        Admin.showMessage(kmsg, err.message, "error");
      } finally {
        refresh.disabled = false;
      }
    });

    return {
      setSaved: function (p) {
        saved = p.kiwify_product_id ? {
          brand: p.brand_id || "", product: p.kiwify_product_id, link: p.kiwify_link_id,
          synced: p.kiwify_synced_at, error: p.kiwify_sync_error
        } : null;
        listBrand = null; // recarrega a lista (o produto pode ter mudado)
        draw();
      },
      brandChanged: draw,
      // Seletor visível: o que está escolhido. Oculto (empresa sem conta conectada): mantém o vínculo
      // gravado se a empresa é a mesma (o site guarda o último preço/link); trocou de empresa: desfaz.
      collect: function () {
        if (!box.hidden) {
          var on = !!(prodSel.value && linkSel.value);
          return { kiwify_product_id: on ? prodSel.value : null, kiwify_link_id: on ? linkSel.value : null };
        }
        var keep = saved && saved.brand === form.elements.brand_id.value;
        return { kiwify_product_id: keep ? saved.product : null, kiwify_link_id: keep ? saved.link : null };
      }
    };
  })();

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
      // A página tem rascunho e versão publicada; o produto publicado é o que a coloca no ar.
      var pending = page && page.published_at && page.has_unpublished_changes
        ? " Há alterações no rascunho que ainda não foram publicadas." : "";
      status.textContent = (!page ? "Este produto ainda não tem página de vendas. Use “Criar página de vendas”, no topo."
        : live ? "No ar em /p/" + product.slug + "."
        : page.published_at ? "A página está publicada, mas o produto não: ela só aparece para o público quando o produto também estiver publicado."
        : "Página em rascunho, ainda não publicada. Publique pelo editor quando estiver pronta.") + pending;
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
      await cover.saveAlt();
      var saved = id
        ? await Admin.api("/products/" + encodeURIComponent(id), { method: "PATCH", body: data })
        : await Admin.api("/products", { method: "POST", body: data });

      if (!id) {
        id = saved.id; slugTouched = true;
        history.replaceState(null, "", "produto.html?id=" + encodeURIComponent(id));
      }
      fill(saved); // mostra os valores como ficaram gravados (ex.: espaços removidos, link normalizado)
      cover.clearMessage(); // o aviso "clique em Salvar" já foi atendido
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

  // Sugestões do campo Área: as áreas já usadas em outros produtos (evita "Gestão" e "gestao").
  async function loadAreas() {
    var seen = {};
    (await Admin.api("/products")).forEach(function (p) {
      var a = (p.area || "").trim();
      if (a && !seen[a.toLowerCase()]) seen[a.toLowerCase()] = a;
    });
    var list = $("area-options");
    Object.keys(seen).map(function (k) { return seen[k]; }).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); })
      .forEach(function (a) { var o = document.createElement("option"); o.value = a; list.append(o); });
  }

  // Carregamento inicial: a mensagem fica fora do formulário, que só aparece se tudo der certo.
  (async function () {
    var loadMsg = $("load-msg");
    try {
      await Admin.requireSession();
      await Promise.all([brand.load(), loadAreas()]);
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
