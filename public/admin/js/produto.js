/* Formulário de produto: cria (produto.html) ou edita (produto.html?id=...). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var form = $("product-form"), msg = $("msg"), saveBtn = $("save");
  var id = new URLSearchParams(location.search).get("id");
  var dirty = false;      // há alterações não salvas?
  var slugTouched = !!id; // na criação, o slug acompanha o título até ser editado à mão
  var savedStatus = null; // situação como está gravada no banco (null = produto ainda não criado)
  var savedSlug = null;   // endereço como está gravado (para o aviso de links quebrados)

  var STATUS_HINTS = {
    draft: "Não aparece no site.",
    published: "Visível no site para os visitantes.",
    archived: "Oculto do site; pode ser publicado de novo."
  };

  Admin.hasUnsavedChanges = function () { return dirty; };

  // Campos de texto enviados como estão; a API apara espaços e transforma vazio em null.
  var TEXT_FIELDS = ["title", "slug", "status", "category", "area", "short_description",
    "checkout_url"];

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
    if (form.elements.area.selectedIndex < 0) form.elements.area.value = ""; // idem para a área
    form.elements.featured.checked = !!p.featured;
    form.elements.card_badge.value = p.card_badge || "available";
    form.elements.price.value = priceToInput(p.price_cents);
    cover.show(p.image || null);
    brand.select(p.brand_id || "");
    offer.setSaved(p); // antes da Kiwify: a lista de links promocionais sai de lá
    kiwify.setSaved(p);
  }

  function collect() {
    var data = {};
    TEXT_FIELDS.forEach(function (f) { data[f] = form.elements[f].value; });
    data.featured = form.elements.featured.checked;
    data.card_badge = form.elements.card_badge.value;
    data.price_cents = parsePrice(form.elements.price.value);
    data.image_id = cover.image ? cover.image.id : null;
    data.brand_id = form.elements.brand_id.value || null;
    Object.assign(data, kiwify.collect());
    Object.assign(data, offer.collect(data));
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

    // Empresa padrão do site (aba Empresas): produto sem empresa mostra a dela na página de vendas.
    function fallback() {
      return brands.find(function (x) { return x.is_default; }) || null;
    }

    // Pré-visualização como no menu da página de vendas: logo e/ou nome sobre fundo escuro.
    function preview() {
      var chosen = brands.find(function (x) { return x.id === select.value; });
      var b = chosen || fallback();
      var img = $("brand-img"), name = $("brand-name-preview");
      img.hidden = !(b && b.logo);
      if (b && b.logo) {
        img.src = b.logo.url; img.width = b.logo.width; img.height = b.logo.height;
        img.alt = b.name ? "" : b.logo.alt_text || "";
      } else {
        img.removeAttribute("src");
      }
      name.textContent = b ? b.name || "" : "Marca do site";
      name.classList.toggle("muted", !chosen);
      $("brand-usage").textContent = chosen && chosen.usage.length > 1
        ? "Usada em " + chosen.usage.length + " produtos: alterações na aba Empresas valem para todos eles."
        : !chosen && b ? "Sem empresa: a página de vendas usa a empresa padrão do site (o preço e o link são preenchidos à mão)." : "";
    }

    function current() {
      return brands.find(function (x) { return x.id === select.value; }) || null;
    }

    function draw(current) {
      var none = document.createElement("option");
      var def = fallback();
      none.value = ""; none.textContent = def ? "Empresa padrão (" + label(def) + ")" : "Marca do site (padrão)";
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
      if (offer) offer.refresh(); // a lista de links promocionais acompanha o produto e o link escolhidos
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
        if (offer) offer.refresh();
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
        offer.syncFrom(p);
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
      links: function () { return links; },          // links do produto escolhido (com preço)
      linkId: function () { return linkSel.value; }, // link normal escolhido
      visible: function () { return !box.hidden; },  // seletor da Kiwify na tela?
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

  /* ---------- Oferta: preço "de/por" e cronômetro na página de vendas ----------
     Com Kiwify, escolhe-se outro link do mesmo produto (com preço menor): preço e link da oferta
     ficam travados, como os normais. Sem Kiwify, são digitados. O fim é em horário de Brasília
     (UTC−3 o ano todo: o Brasil não tem horário de verão desde 2019). */
  var offer = (function () {
    var sel = $("offer_link"), kbox = $("offer-kiwify"), info = $("offer-info");
    var priceIn = form.elements.offer_price, urlIn = form.elements.offer_checkout_url, endsIn = form.elements.offer_ends_at;
    var savedLink = null; // link promocional gravado

    function option(value, text) {
      var o = document.createElement("option");
      o.value = value; o.textContent = text;
      return o;
    }
    // "2026-10-25T23:59" (campo) <-> ISO com fuso de Brasília.
    function toIso(local) { return local ? local + ":00-03:00" : null; }
    function fromIso(iso) {
      if (!iso) return "";
      return new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 16);
    }
    var kiwifyOn = function () { return !!kiwify.collect().kiwify_product_id; };

    // Preço e link da oferta a partir do link promocional escolhido.
    function applyLink() {
      if (!kiwifyOn() || !kiwify.visible()) return preview();
      var l = kiwify.links().find(function (x) { return x.id === sel.value; });
      if (l) { priceIn.value = priceToInput(l.price_cents); urlIn.value = l.checkout_url; }
      else if (!sel.value) { priceIn.value = ""; urlIn.value = ""; }
      preview();
    }

    // Monta a lista de links promocionais (todos os links do produto, menos o normal).
    function refresh() {
      var on = kiwifyOn();
      priceIn.readOnly = urlIn.readOnly = on;
      kbox.hidden = !(on && kiwify.visible());
      if (kbox.hidden) return preview();
      var keep = sel.value; // escolha atual (ao abrir, a gravada: ver setSaved)
      var list = kiwify.links().filter(function (l) { return l.id !== kiwify.linkId(); });
      sel.replaceChildren.apply(sel, [option("", "Sem oferta")].concat(list.map(function (l) {
        return option(l.id, l.name + " — " + Admin.formatPrice(l.price_cents) + (l.status === "active" ? "" : " (desativado)"));
      })));
      // Link gravado que sumiu da lista (desativado na Kiwify): continua escolhido, com aviso no nome.
      var missing = keep && keep === savedLink && keep !== kiwify.linkId() && !list.some(function (l) { return l.id === keep; });
      if (missing) sel.append(option(keep, "Link vinculado (" + keep + ")"));
      sel.value = keep;
      if (sel.selectedIndex < 0) sel.value = ""; // a escolha não existe mais: "Sem oferta"
      applyLink();
    }

    // Resumo do que a página vai mostrar (e avisos de oferta que não aparece).
    function preview() {
      var price = parsePrice(form.elements.price.value), op = parsePrice(priceIn.value), ends = toIso(endsIn.value);
      if (op === null && !urlIn.value) return Admin.showMessage(info, "Sem oferta: a página mostra o preço normal.");
      if (Number.isNaN(op)) return Admin.showMessage(info, "Use o formato 97,00 no preço da oferta.", "error");
      if (op === null || !urlIn.value) return Admin.showMessage(info, "Preencha o preço e o link da oferta.", "error");
      if (typeof price === "number" && op >= price) {
        return Admin.showMessage(info, "O preço da oferta precisa ser menor que o preço normal (" + Admin.formatPrice(price) + ").", "error");
      }
      if (ends && Date.parse(ends) <= Date.now()) return Admin.showMessage(info, "O prazo já passou: a página mostra o preço normal.", "error");
      var when = ends ? new Date(ends).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "";
      Admin.showMessage(info, "Na página: " + (typeof price === "number" ? "de " + Admin.formatPrice(price) + " " : "") +
        "por " + Admin.formatPrice(op) + (ends ? ", com cronômetro até " + when + "." : ", sem prazo."), "success");
    }

    sel.addEventListener("change", applyLink);
    [priceIn, urlIn, endsIn, form.elements.price].forEach(function (input) { input.addEventListener("input", preview); });
    $("offer-clear").addEventListener("click", function () {
      sel.value = "";
      priceIn.value = ""; urlIn.value = ""; endsIn.value = "";
      dirty = true;
      preview();
      Admin.showMessage(info, "Oferta removida. Clique em Salvar para aplicar.");
    });

    return {
      setSaved: function (p) {
        savedLink = p.offer_kiwify_link_id || null;
        sel.replaceChildren(option("", "Sem oferta"));
        if (savedLink) { sel.append(option(savedLink, "Carregando…")); sel.value = savedLink; }
        priceIn.value = priceToInput(p.offer_price_cents);
        urlIn.value = p.offer_checkout_url || "";
        endsIn.value = fromIso(p.offer_ends_at);
        preview();
      },
      refresh: refresh,
      // Depois do "Atualizar agora": preço e link da oferta como a Kiwify devolveu.
      syncFrom: function (p) {
        priceIn.value = priceToInput(p.offer_price_cents);
        urlIn.value = p.offer_checkout_url || "";
        preview();
      },
      // Com Kiwify vai só o link promocional (o servidor busca preço e link); sem, os campos digitados.
      collect: function (data) {
        var ends = toIso(endsIn.value);
        if (data.kiwify_product_id) {
          return { offer_kiwify_link_id: kiwify.visible() ? sel.value || null : savedLink, offer_ends_at: ends };
        }
        return {
          offer_kiwify_link_id: null, offer_price_cents: parsePrice(priceIn.value),
          offer_checkout_url: urlIn.value, offer_ends_at: ends
        };
      }
    };
  })();

  // Ajusta a tela ao produto como está GRAVADO (não ao que foi alterado e ainda não salvo).
  function setMode(product) {
    var title = product ? "Editar produto" : "Novo produto";
    $("heading").textContent = title;
    document.title = title + " — Painel administrativo";
    savedSlug = product ? product.slug : null;
    savedStatus = product ? product.status : null;
    updateSlugHint();
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

  /* ---------- Links de divulgação ----------
     Um link por canal (utm_source) e uma campanha opcional (utm_campaign), já padronizados
     ("Black Friday!" vira black-friday) para os números não se espalharem no Resumo.
     O endereço é o da página pública: a de vendas, se estiver publicada; senão a de detalhes. */
  var promo = (function () {
    var box = $("promo"), list = $("promo-links"), campaign = $("promo-campaign"), warn = $("promo-warn");
    var saved = null, salesPage = false, rows = [], suggested = false;

    function link(source) {
      if (!saved || !source) return "";
      var path = salesPage ? "/p/" + encodeURIComponent(saved.slug) : "/produto.html?id=" + encodeURIComponent(saved.slug);
      var url = new URL(path, document.baseURI); // o próprio site (em produção, o domínio)
      url.searchParams.set("utm_source", source);
      var c = slugify(campaign.value);
      if (c) url.searchParams.set("utm_campaign", c);
      return url.href;
    }

    async function copy(input, btn, label) {
      try {
        await navigator.clipboard.writeText(input.value);
      } catch (e) {
        input.select();
        document.execCommand("copy");
      }
      btn.textContent = "Copiado ✓";
      $("promo-msg").textContent = "Link para " + label + " copiado.";
      setTimeout(function () { btn.textContent = "Copiar"; }, 2000);
    }

    function row(label, sourceOf, extra) {
      var li = document.createElement("li");
      var name = document.createElement("span");
      name.className = "promo-name";
      name.textContent = label;
      var input = document.createElement("input");
      input.readOnly = true;
      input.className = "promo-url";
      input.setAttribute("aria-label", "Link para " + label);
      input.addEventListener("focus", function () { input.select(); });
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm btn-outline";
      btn.textContent = "Copiar";
      btn.setAttribute("aria-label", "Copiar link para " + label);
      btn.addEventListener("click", function () { copy(input, btn, label); });
      var line = document.createElement("span");
      line.className = "promo-line";
      if (extra) line.append(extra);
      line.append(input, btn);
      li.append(name, line);
      list.append(li);
      rows.push(function () {
        input.value = link(sourceOf());
        if (extra) input.placeholder = "Digite o nome do canal";
        btn.disabled = !input.value;
      });
    }

    var other = document.createElement("input");
    other.className = "promo-other";
    other.maxLength = 40;
    other.placeholder = "ex.: youtube";
    other.autocapitalize = "none";
    other.spellcheck = false;
    other.setAttribute("aria-label", "Nome de outro canal");

    Admin.UTM_SOURCES.forEach(function (s) { row(s.label, function () { return s.value; }); });
    row("Outro", function () { return slugify(other.value); }, other);

    function draw() { rows.forEach(function (fn) { fn(); }); }
    campaign.addEventListener("input", draw);
    other.addEventListener("input", draw);
    // Ao sair do campo, mostra o nome já padronizado (o mesmo que vai no link).
    campaign.addEventListener("change", function () { campaign.value = slugify(campaign.value); draw(); });
    other.addEventListener("change", function () { other.value = slugify(other.value); draw(); });

    function warning() {
      var msgs = [];
      if (saved && saved.status !== "published") msgs.push("Os links só funcionam depois que o produto for publicado.");
      if (saved && form.elements.slug.value !== saved.slug) msgs.push("O endereço (slug) foi alterado: salve para atualizar os links.");
      warn.textContent = msgs.join(" ");
      warn.hidden = !msgs.length;
    }
    form.elements.slug.addEventListener("input", warning);

    async function loadSuggestions() {
      if (suggested) return;
      suggested = true;
      try {
        var names = await Admin.api("/dashboard/campaigns");
        $("promo-campaigns").replaceChildren.apply($("promo-campaigns"), names.map(function (n) {
          var o = document.createElement("option");
          o.value = n;
          return o;
        }));
      } catch (e) { /* sem sugestões; o campo continua funcionando */ }
    }

    return {
      set: function (product, hasSalesPage) {
        saved = product; salesPage = !!hasSalesPage;
        box.hidden = !product;
        if (!product) return;
        draw();
        warning();
        loadSuggestions();
      }
    };
  })();

  // Área "Página de vendas": situação da página e links para pré-visualizar / ver publicada.
  // A página só é pública com o produto publicado E a página publicada.
  async function refreshSalesZone(product) {
    var zone = $("sales"), status = $("sales-status"), preview = $("sales-preview"), pub = $("sales-public");
    zone.hidden = !product;
    if (!product) { promo.set(null); return; }
    try {
      var page = await Admin.api("/products/" + encodeURIComponent(product.id) + "/sales-page");
      promo.set(product, !!(page && page.published_at));
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
      promo.set(product, false);
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
      location.replace("produtos.html");
    } catch (err) {
      Admin.showMessage($("danger-msg"), err.message, "error");
    }
  });

  form.elements.title.addEventListener("input", function () {
    if (!slugTouched) form.elements.slug.value = slugify(form.elements.title.value);
  });
  // O aviso de links quebrados só aparece quando o endereço de um produto publicado é de fato alterado.
  function updateSlugHint() {
    $("slug-hint").hidden = !(savedSlug && savedStatus === "published" && form.elements.slug.value !== savedSlug);
  }
  form.elements.slug.addEventListener("input", function () {
    slugTouched = form.elements.slug.value !== ""; // apagou tudo? volta a acompanhar o título
    updateSlugHint();
  });
  form.elements.price.addEventListener("input", function () { form.elements.price.setCustomValidity(""); });
  form.elements.offer_price.addEventListener("input", function () { form.elements.offer_price.setCustomValidity(""); });
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
    if (Number.isNaN(data.offer_price_cents)) {
      form.elements.offer_price.setCustomValidity("Use o formato 97,00 (ou deixe vazio para não ter oferta).");
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

  // Opções do campo Área: a lista fixa do servidor (server/lib/areas.js).
  async function loadAreas() {
    var select = form.elements.area;
    (await Admin.api("/products/areas")).forEach(function (a) {
      var o = document.createElement("option"); o.value = a; o.textContent = a; select.append(o);
    });
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
