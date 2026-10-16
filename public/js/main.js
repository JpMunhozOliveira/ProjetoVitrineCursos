(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var S = window.SITE || {};

  // Cria elementos usando textContent (nunca innerHTML com dados)
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) { n.append(c); });
    return n;
  }
  var isUrl = function (u) { return typeof u === "string" && /^https:\/\//.test(u); };
  var brl = function (p) {
    return typeof p === "number" ? p.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
  };

  // Produtos vêm da API (cadastrados no painel). Esta função converte o formato da API para o
  // formato que o restante deste arquivo já usava — assim os cartões, filtros e detalhes não mudam.
  function fromApi(p) {
    return {
      id: p.slug,
      titulo: p.title,
      resumo: p.short_description || "",
      descricao: p.description || "",
      categoria: p.category || "",
      destaque: !!p.featured,
      imagem: p.image ? p.image.url : null,
      imagemAlt: p.image ? p.image.alt_text || "" : "",
      publico: p.audience || "",
      preRequisitos: p.prerequisites || "",
      conteudo: p.modules || [],
      formato: p.format || "",
      cargaHoraria: p.workload || "",
      preco: p.price_cents === null || p.price_cents === undefined ? null : p.price_cents / 100,
      checkoutUrl: p.checkout_url || "",
      // Com página de vendas publicada, o cartão leva direto para ela.
      pagina: p.has_sales_page ? "/p/" + encodeURIComponent(p.slug) : null,
    };
  }
  async function getJson(url) {
    var res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) { var err = new Error("HTTP " + res.status); err.status = res.status; throw err; }
    return (await res.json()).data;
  }
  function loadError(target) {
    target.removeAttribute("aria-busy");
    target.textContent = "";
    target.append(el("p", { "class": "muted", text: "Não foi possível carregar os produtos agora. Recarregue a página para tentar de novo." }));
  }

  // Textos globais: <span data-site="nome"> ou "professor.bio"
  document.querySelectorAll("[data-site]").forEach(function (n) {
    var v = n.dataset.site.split(".").reduce(function (o, k) { return o && o[k]; }, S);
    n.textContent = v || "";
  });
  document.querySelectorAll("[data-year]").forEach(function (n) { n.textContent = new Date().getFullYear(); });
  var page = document.body.dataset.page;
  if (page === "home") {
    document.title = S.nome + " — " + S.slogan;
    var md = document.querySelector('meta[name="description"]');
    if (md && S.descricao) md.setAttribute("content", S.descricao);
  }

  // Foto do professor
  var photo = document.getElementById("foto-professor");
  if (photo) {
    if (S.professor && S.professor.foto) {
      photo.append(el("img", { src: S.professor.foto, alt: S.professor.fotoAlt || "", loading: "lazy" }));
    } else {
      photo.textContent = ((S.professor && S.professor.nome) || "P").charAt(0);
      photo.setAttribute("aria-hidden", "true");
    }
  }

  function cover(c) {
    var box = el("div", { "class": "cover" });
    if (c.imagem) box.append(el("img", { src: c.imagem, alt: c.imagemAlt || "", loading: "lazy" }));
    else { box.setAttribute("aria-hidden", "true"); box.textContent = (c.titulo || "?").charAt(0); }
    return box;
  }
  function buyButton(c) {
    if (isUrl(c.checkoutUrl))
      return el("a", { "class": "btn", href: c.checkoutUrl, target: "_blank", rel: "noopener noreferrer", text: "Comprar na Kiwify (abre em nova aba)" });
    return el("span", { "class": "btn btn-disabled", "aria-disabled": "true", text: "Compra em breve" });
  }

  // Catálogo
  // Cards "fantasma" com brilho, enquanto carrega ou pesquisa
  function renderSkeleton(target, n) {
    target.textContent = "";
    target.setAttribute("aria-busy", "true");
    for (var i = 0; i < n; i++) target.append(el("div", { "class": "skeleton-card", "aria-hidden": "true" }));
  }

  function renderCards(target, list) {
    target.removeAttribute("aria-busy");
    target.textContent = "";
    if (!list.length) {
      target.append(el("p", { "class": "muted", text: "Nenhum produto encontrado. Tente outra busca ou categoria." }));
      return;
    }
    list.forEach(function (c) {
      var body = el("div", { "class": "card-body" }, [
        c.categoria ? el("p", { "class": "eyebrow", text: c.categoria }) : "",
        el("h3", { text: c.titulo }),
        el("p", { text: c.resumo }),
        c.publico ? el("p", { "class": "muted", text: c.publico }) : "",
        brl(c.preco) ? el("p", { "class": "price", text: brl(c.preco) }) : "",
        el("a", { "class": "btn btn-outline", href: c.pagina || ("/produto.html?id=" + encodeURIComponent(c.id)),
                  "aria-label": "Ver detalhes: " + c.titulo, text: "Ver detalhes" })
      ]);
      target.append(el("article", { "class": "card" }, [cover(c), body]));
    });
  }
  
  // Home (destaques) e catálogo (busca + categorias). Os esqueletos do HTML ficam na tela
  // enquanto a lista chega da API.
  var catalog = document.getElementById("catalogo");
  async function initCatalog() {
    var C;
    try { C = (await getJson("/api/products")).map(fromApi); } catch (e) { loadError(catalog); return; }

    if (page === "home") {
      var feat = C.filter(function (c) { return c.destaque; });
      var shown = (feat.length ? feat : C).slice(0, 6);
      if (!shown.length) {
        catalog.removeAttribute("aria-busy");
        catalog.textContent = "";
        catalog.append(el("p", { "class": "muted", text: "Novos produtos em breve." }));
      } else {
        renderCards(catalog, shown);
      }
      var all = document.getElementById("ver-todos");
      if (all && C.length <= shown.length) all.hidden = true;
      return;
    }

    var q = document.getElementById("busca"), sel = document.getElementById("categoria"),
        out = document.getElementById("resultado"), cats = [];
    C.forEach(function (c) { if (c.categoria && cats.indexOf(c.categoria) < 0) cats.push(c.categoria); });
    if (cats.length > 1) cats.forEach(function (t) { sel.append(el("option", { value: t, text: t })); });
    else document.getElementById("filtro-categoria").hidden = true;
    if (C.length < 4) document.getElementById("filtros").hidden = true; // poucos produtos: sem filtros
    var norm = function (t) { return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    var apply = function () {
      var term = norm(q.value), cat = sel.value;
      var list = C.filter(function (c) {
        return (!cat || c.categoria === cat) &&
          (!term || norm([c.titulo, c.resumo, c.publico, c.categoria].join(" ")).indexOf(term) >= 0);
      });
      renderCards(catalog, list);
      out.textContent = list.length + (list.length === 1 ? " produto encontrado" : " produtos encontrados");
    };
    var timer, reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var onChange = function () {
      clearTimeout(timer);
      if (reduce) { apply(); return; }       // movimento reduzido: resposta imediata, sem esqueleto
      renderSkeleton(catalog, 3);
      out.textContent = "Buscando…";
      timer = setTimeout(apply, 350);        // também evita redesenhar a cada tecla
    };
    q.addEventListener("input", onChange);
    sel.addEventListener("change", onChange);
    apply();
  }
  if (catalog) initCatalog();

  // Página de detalhes (produtos sem página de vendas publicada): /produto.html?id=endereco
  var box = document.getElementById("produto");
  async function initDetail() {
    var id = new URLSearchParams(location.search).get("id") || "";
    var c = null;
    try {
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) c = fromApi(await getJson("/api/products/" + encodeURIComponent(id)));
    } catch (e) {
      if (e.status !== 404) { loadError(box); return; }
    }
    box.textContent = ""; // remove o esqueleto de carregamento
    if (!c) {
      document.title = "Produto não encontrado — " + S.nome;
      box.append(el("h1", { text: "Produto não encontrado" }),
        el("p", {}, [el("a", { href: "/catalogo.html", text: "Voltar ao catálogo" })]));
      return;
    }
    // Tem página de vendas publicada? Ela é a página "oficial" do produto.
    if (c.pagina) { location.replace(c.pagina); return; }
    document.title = c.titulo + " — " + S.nome;
    var m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", c.resumo || "");
    var facts = [["Formato", c.formato], ["Carga horária", c.cargaHoraria], ["Pré-requisitos", c.preRequisitos]]
      .filter(function (f) { return f[1]; })
      .map(function (f) { return el("li", {}, [el("strong", { text: f[0] + ": " }), f[1]]); });
    var main = el("div", {}, [
      el("a", { "class": "crumb", href: "/catalogo.html", text: "← Todos os produtos" }),
      el("h1", { text: c.titulo }),
      el("p", { "class": "muted", text: c.resumo }),
      c.descricao ? el("div", {}, [el("h2", { text: "Sobre" }), el("p", { text: c.descricao })]) : "",
      c.publico ? el("div", {}, [el("h2", { text: "Para quem é" }), el("p", { text: c.publico })]) : "",
      (c.conteudo || []).length ? el("div", {}, [el("h2", { text: "Conteúdo" }),
        el("ul", {}, c.conteudo.map(function (t) { return el("li", { text: t }); }))]) : "",
      facts.length ? el("div", {}, [el("h2", { text: "Informações" }), el("ul", {}, facts)]) : ""
    ]);
    var aside = el("aside", { "class": "buy-box", "aria-label": "Compra" }, [
      cover(c),
      brl(c.preco) ? el("p", { "class": "price", text: brl(c.preco) }) : "",
      buyButton(c),
      el("p", { "class": "muted", text: "O pagamento e o acesso são feitos pela Kiwify." })
    ]);
    box.append(main, aside);
  }
  if (box) initDetail();

  // Contato
  var list = document.getElementById("contato-links");
  if (list) {
    var ct = S.contato || {}, items = [];
    if (ct.email) items.push(["E-mail", "mailto:" + ct.email, false]);
    if (ct.whatsapp) items.push(["WhatsApp", "https://wa.me/" + ct.whatsapp, true]);
    (ct.redes || []).forEach(function (r) { if (isUrl(r.url)) items.push([r.nome, r.url, true]); });
    items.forEach(function (i) {
      var a = el("a", { "class": "btn btn-outline", href: i[1], text: i[0] });
      if (i[2]) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
                  a.setAttribute("aria-label", i[0] + " (abre em nova aba)"); }
      list.append(el("li", {}, [a]));
    });
  }

  // Modo noturno: o botão é ligado por theme.js (compartilhado com o painel).

  // Menu mobile
  var btn = document.getElementById("menu-btn"), nav = document.getElementById("nav");
  if (btn && nav) {
    function close() { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function () {
      btn.setAttribute("aria-expanded", String(nav.classList.toggle("open")));
    });
    nav.addEventListener("click", function (e) { if (e.target.tagName === "A") close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) { close(); btn.focus(); }
    });
  }
})();
