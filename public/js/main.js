(function () {
  "use strict";
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

  // Preço do cartão e da página de detalhes: com oferta, "de R$ X" riscado antes do preço atual.
  function priceEl(c) {
    if (!brl(c.preco)) return "";
    if (!brl(c.precoDe)) return el("p", { "class": "price", text: brl(c.preco) });
    return el("p", { "class": "price" }, [
      el("s", { "class": "price-was" }, [el("span", { "class": "sr-only", text: "De " }), brl(c.precoDe)]),
      el("span", { "class": "sr-only", text: " por " }), " " + brl(c.preco)
    ]);
  }

  // Produtos vêm da API (cadastrados no painel). Esta função converte o formato da API para o
  // formato que o restante deste arquivo já usava — assim os cartões, filtros e detalhes não mudam.
  function fromApi(p) {
    return {
      id: p.slug,
      titulo: p.title,
      resumo: p.short_description || "",
      categoria: p.category || "",
      area: (p.area || "").trim(),
      criado: p.created_at ? new Date(p.created_at).getTime() : 0,
      destaque: !!p.featured,
      selo: p.card_badge || "available", // available | last_chance | new | none
      imagem: p.image ? p.image.url : null,
      imagemAlt: p.image ? p.image.alt_text || "" : "",
      imagemSrcset: p.image ? p.image.srcset || null : null,
      // Empresa do produto (Editar produto > Empresa): "Por <nome>" no topo do cartão e dos detalhes.
      empresa: p.brand_name || "",
      // Logo da empresa: aparece no cartão, ao lado da categoria. Com o nome escrito acima, o logo é
      // só decorativo (alt vazio: leitores de tela não repetem o nome).
      marca: p.brand_logo ? { url: p.brand_logo.url, alt: p.brand_name ? "" : p.brand_logo.alt_text || "",
        width: p.brand_logo.width || 1, height: p.brand_logo.height || 1 } : null,
      preco: p.price_cents === null || p.price_cents === undefined ? null : p.price_cents / 100,
      // Com oferta ativa (cadastro do produto), o preço normal vem em compare_price_cents ("de").
      precoDe: typeof p.compare_price_cents === "number" ? p.compare_price_cents / 100 : null,
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
    // Parte do slogan em laranja no título (site.js: sloganDestaque). Montado sem HTML.
    var h1 = document.getElementById("t-inicio"), hl = S.sloganDestaque || "";
    var at = h1 && hl ? (S.slogan || "").indexOf(hl) : -1;
    if (at >= 0) {
      h1.textContent = "";
      h1.append(S.slogan.slice(0, at), el("span", { "class": "hl", text: hl }), S.slogan.slice(at + hl.length));
    }
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

  // sizes: largura em que a capa aparece (card do catálogo ou caixa de compra da página do produto);
  // com o srcset, o navegador baixa a menor versão que fica nítida.
  var COVER_SIZES = {
    card: "(min-width: 1100px) 270px, (min-width: 540px) 50vw, calc(100vw - 2rem)",
    detail: "(min-width: 900px) 400px, calc(100vw - 2rem)",
    hero: "(min-width: 860px) 360px, 70vw"
  };
  function cover(c, where) {
    var box = el("div", { "class": "cover" });
    if (c.imagem) {
      var attrs = { src: c.imagem, alt: c.imagemAlt || "", loading: "lazy" };
      if (c.imagemSrcset) { attrs.srcset = c.imagemSrcset; attrs.sizes = COVER_SIZES[where || "card"]; }
      box.append(el("img", attrs));
    }
    else { box.setAttribute("aria-hidden", "true"); box.textContent = (c.titulo || "?").charAt(0); }
    return box;
  }
  function buyButton(c) {
    if (isUrl(c.checkoutUrl))
      return el("a", { "class": "btn-cta", href: c.checkoutUrl, target: "_blank", rel: "noopener noreferrer", text: "Comprar na Kiwify (abre em nova aba)" });
    return el("span", { "class": "btn btn-disabled", "aria-disabled": "true", text: "Compra em breve" });
  }

  // Catálogo
  // Cards "fantasma" com brilho, enquanto carrega ou pesquisa
  function renderSkeleton(target, n) {
    target.textContent = "";
    target.setAttribute("aria-busy", "true");
    for (var i = 0; i < n; i++) target.append(el("div", { "class": "skeleton-card", "aria-hidden": "true" }));
  }

  // Selo ao lado do preço, escolhido no painel (Editar produto > Selo no cartão).
  function badgeEl(kind) {
    if (kind === "none") return "";
    if (kind === "new") {
      return el("span", { "class": "card-badge is-new" }, [el("span", { "aria-hidden": "true", text: "✦" }), " Novidade"]);
    }
    if (kind === "last_chance") {
      return el("span", { "class": "card-badge is-urgent" }, [el("span", { "aria-hidden": "true", text: "⏳" }), " Última chance"]);
    }
    return el("span", { "class": "card-badge" }, [el("span", { "aria-hidden": "true", text: "✓" }), " Acesso imediato"]);
  }

  function renderCards(target, list) {
    target.removeAttribute("aria-busy");
    target.textContent = "";
    if (!list.length) {
      target.append(el("p", { "class": "muted", text: "Nenhum produto encontrado. Tente outra busca ou categoria." }));
      return;
    }
    list.forEach(function (c) {
      // Página de vendas publicada = destino principal; sem ela, a página de detalhes.
      var href = c.pagina || ("/produto.html?id=" + encodeURIComponent(c.id));
      var body = el("div", { "class": "card-body" }, [
        // A etiqueta "Destaque" fica na capa, que é escondida dos leitores de tela; aqui vai o aviso para eles.
        c.destaque ? el("span", { "class": "sr-only", text: "Em destaque." }) : "",
        // A empresa aparece só pelo logo, ao lado da categoria (o logo leva o nome dela no alt).
        c.categoria || c.marca ? el("div", { "class": "card-meta" }, [
          c.marca ? el("img", { "class": "card-brand", src: c.marca.url, alt: c.empresa || c.marca.alt,
            width: c.marca.width, height: c.marca.height, loading: "lazy" }) : "",
          c.categoria ? el("p", { "class": "eyebrow", text: c.categoria }) : ""
        ]) : "",
        el("h3", { text: c.titulo }),
        el("p", { "class": "muted", text: c.resumo }),
        // Rodapé: preço e selo na mesma linha; embaixo, "Ver detalhes" na largura do cartão.
        el("div", { "class": "card-foot" }, [
          el("div", { "class": "card-price-row" }, [
            priceEl(c),
            badgeEl(c.selo)
          ]),
          el("a", { "class": "card-link", href: href, "aria-label": "Ver detalhes: " + c.titulo, text: "Ver detalhes" })
        ])
      ]);
      // A imagem também leva ao produto. Fica fora da ordem do Tab e dos leitores de tela:
      // o link "Ver detalhes" já é o caminho acessível (evita dois links iguais em sequência).
      var coverLink = el("a", { "class": "card-cover", href: href, tabindex: "-1", "aria-hidden": "true" }, [
        cover(c),
        c.destaque ? el("span", { "class": "card-flag" }, [el("span", { "aria-hidden": "true", text: "★" }), " Destaque"]) : ""
      ]);
      target.append(el("article", { "class": c.destaque ? "card card-featured" : "card" }, [coverLink, body]));
    });
  }
  
  // Home (destaques) e catálogo (busca + categorias). Os esqueletos do HTML ficam na tela
  // enquanto a lista chega da API.
  var catalog = document.getElementById("catalogo");
  var norm = function (t) { return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); };
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
      renderAreas(C);
      renderNews(C, shown);
      renderHeroCovers(C);
      return;
    }

    var q = document.getElementById("busca"), sel = document.getElementById("categoria"),
        areaSel = document.getElementById("area"), out = document.getElementById("resultado");
    // Opções de um filtro: valores distintos (área sem diferenciar maiúsculas); com menos de 2, some.
    var fillFilter = function (select, wrap, key) {
      var vals = groupBy(C, key).map(function (g) { return g.name; });
      if (vals.length > 1) vals.forEach(function (t) { select.append(el("option", { value: t, text: t })); });
      else document.getElementById(wrap).hidden = true;
    };
    fillFilter(sel, "filtro-categoria", "categoria");
    fillFilter(areaSel, "filtro-area", "area");
    // Link vindo da página inicial (?area=Gestão ou ?categoria=Curso): já abre filtrado.
    var params = new URLSearchParams(location.search), fromLink = false;
    [[areaSel, "area"], [sel, "categoria"]].forEach(function (f) {
      var want = norm(params.get(f[1]));
      if (!want) return;
      var opt = [].filter.call(f[0].options, function (o) { return o.value && norm(o.value) === want; })[0];
      if (!opt && f[1] === "area") { // área única no catálogo: o seletor está escondido, mas o filtro vale
        var only = groupBy(C, "area")[0];
        if (only && norm(only.name) === want) { opt = el("option", { value: only.name, text: only.name }); f[0].append(opt); }
      }
      if (opt) { f[0].value = opt.value; fromLink = true; }
    });
    if (C.length < 4 && !fromLink) document.getElementById("filtros").hidden = true; // poucos produtos: sem filtros
    var apply = function () {
      var term = norm(q.value), cat = sel.value, area = norm(areaSel.value);
      var list = C.filter(function (c) {
        return (!cat || c.categoria === cat) && (!area || norm(c.area) === area) &&
          (!term || norm([c.titulo, c.resumo, c.categoria, c.area, c.empresa].join(" ")).indexOf(term) >= 0);
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
    areaSel.addEventListener("change", onChange);
    apply();
  }

  // Valores distintos de um campo (ex.: área), juntando "Gestão" e "gestao", com quantos produtos
  // cada um tem. Fica o primeiro jeito de escrever encontrado. Em ordem alfabética.
  function groupBy(list, key) {
    var groups = {};
    list.forEach(function (c) {
      var name = c[key];
      if (!name) return;
      var k = norm(name);
      if (!groups[k]) groups[k] = { name: name, count: 0 };
      groups[k].count++;
    });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, "pt-BR"); });
  }

  // Página inicial: um cartão por área de conhecimento, levando ao catálogo já filtrado.
  function renderAreas(C) {
    var section = document.getElementById("areas"), list = document.getElementById("areas-lista");
    if (!section) return;
    var areas = groupBy(C, "area");
    if (!areas.length) return; // nenhum produto com área: a seção continua escondida
    areas.forEach(function (a) {
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "ico");
      svg.setAttribute("aria-hidden", "true");
      var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#i-book");
      svg.append(use);
      var count = a.count + (a.count === 1 ? " conteúdo" : " conteúdos");
      list.append(el("li", {}, [el("a", { "class": "area-card", href: "/catalogo.html?area=" + encodeURIComponent(a.name) }, [
        svg, el("span", {}, [el("strong", { text: a.name }), el("span", { text: count })])
      ])]));
    });
    section.hidden = false;
  }

  // Página inicial: composição de capas em 3D à direita do título (até 4, destaques primeiro).
  // Com menos de 2 capas não aparece e o texto ocupa a largura toda.
  function renderHeroCovers(C) {
    var box = document.getElementById("hero-covers");
    if (!box) return;
    var withCover = C.filter(function (c) { return c.imagem; });
    var list = withCover.filter(function (c) { return c.destaque; })
      .concat(withCover.filter(function (c) { return !c.destaque; })).slice(0, 4);
    if (list.length < 2) { box.parentNode.classList.add("no-covers"); return; }
    list.forEach(function (c) {
      var href = c.pagina || ("/produto.html?id=" + encodeURIComponent(c.id));
      var img = cover(c, "hero").querySelector("img");
      img.alt = "";
      img.removeAttribute("loading"); // está no topo da página: carrega logo
      img.decoding = "async";
      box.append(el("a", { "class": "hero-cover", href: href, tabindex: "-1" }, [img]));
    });
    box.dataset.count = list.length;
    box.hidden = false;
  }

  // Página inicial: novidades = publicados nos últimos 60 dias que não aparecem nos destaques.
  var NEW_DAYS = 60;
  function renderNews(C, shown) {
    var section = document.getElementById("novidades"), list = document.getElementById("novidades-lista");
    if (!section) return;
    var since = Date.now() - NEW_DAYS * 864e5;
    var news = C.filter(function (c) { return c.criado >= since && shown.indexOf(c) < 0; })
      .sort(function (a, b) { return b.criado - a.criado; }).slice(0, 3);
    if (!news.length) return;
    renderCards(list, news);
    section.hidden = false;
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
    // Conta a visita (track.js) só aqui: com página de vendas, quem conta é ela, após o redirecionamento.
    if (window.SiteTrack && !(c && c.pagina)) window.SiteTrack.view(c ? c.id : null);
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
    var main = el("div", {}, [
      el("a", { "class": "crumb", href: "/catalogo.html", text: "← Todos os produtos" }),
      c.empresa ? el("p", { "class": "card-by" }, ["Por ", el("strong", { text: c.empresa })]) : "",
      el("h1", { text: c.titulo }),
      el("p", { "class": "muted", text: c.resumo })
    ]);
    var aside = el("aside", { "class": "buy-box", "aria-label": "Compra" }, [
      cover(c, "detail"),
      priceEl(c),
      buyButton(c),
      el("p", { "class": "muted", text: "O pagamento e o acesso são feitos pela Kiwify." })
    ]);
    box.append(main, aside);
  }
  if (box) initDetail();

  // Contato: um cartão por canal (e-mail, WhatsApp, redes), a partir de data/site.js.
  var list = document.getElementById("contato-links");
  if (list) {
    var ct = S.contato || {}, items = [];
    if (ct.email) items.push(["E-mail", ct.email, "mailto:" + ct.email, false]);
    if (ct.whatsapp) items.push(["WhatsApp", "Conversar pelo WhatsApp", "https://wa.me/" + ct.whatsapp, true]);
    (ct.redes || []).forEach(function (r) { if (isUrl(r.url)) items.push([r.nome, r.url.replace(/^https:\/\/(www\.)?/, ""), r.url, true]); });
    items.forEach(function (i) {
      var a = el("a", { "class": "contact-card", href: i[2] }, [el("strong", { text: i[0] }), el("span", { text: i[1] })]);
      if (i[3]) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
                  a.setAttribute("aria-label", i[0] + ": " + i[1] + " (abre em nova aba)"); }
      list.append(el("li", {}, [a]));
    });
  }

  // Sobre: texto em parágrafos, valores em cartões e quem ensina (só aparece com nome preenchido).
  var aboutText = document.getElementById("sobre-texto"), values = document.getElementById("valores");
  var about = S.sobre || {};
  if (aboutText) (about.texto || "").split(/\n\s*\n/).forEach(function (t) { if (t.trim()) aboutText.append(el("p", { text: t.trim() })); });
  if (values) (about.valores || []).forEach(function (v) {
    values.append(el("article", { "class": "v-card" }, [el("h3", { text: v.titulo }), el("p", { text: v.texto })]));
  });
  var teacher = document.getElementById("professor");
  if (teacher && S.professor && S.professor.nome) teacher.hidden = false;

  // Menu flutuante: fica mais opaco depois que a página rola (ver site.css).
  var header = document.querySelector(".site-header");

  // Botão "voltar ao topo": aparece depois de rolar um pouco mais de uma tela. Fora do editor do
  // painel (lá a página é só uma prévia). Ao voltar, o foco vai para o início da página.
  var toTop = null;
  if (!document.documentElement.hasAttribute("data-editor")) {
    toTop = el("button", { "class": "to-top", type: "button", "aria-label": "Voltar ao topo", title: "Voltar ao topo" });
    toTop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    toTop.addEventListener("click", function () {
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      var start = document.querySelector(".skip") || document.body;
      start.focus({ preventScroll: true });
    });
    document.body.append(toTop);
  }

  // Página de vendas: botão "Acessar agora" ao lado do "voltar ao topo", direto para o checkout.
  // O link é o dos botões de compra da página (o servidor já põe o da oferta, se houver). Leva a
  // classe btn-cta: o clique é contado e a origem (UTM) vai junto para a Kiwify (track.js).
  // Some enquanto algum botão de compra da própria página está na tela (não fica repetido).
  var buy = null, ctaInView = 0;
  var checkout = toTop && document.body.dataset.page === "venda" && document.querySelector("main a.btn-cta[href]");
  if (checkout) {
    buy = el("a", { "class": "btn-cta float-buy", href: checkout.getAttribute("href"), target: "_blank", rel: "noopener noreferrer" },
      ["Acessar agora", el("span", { "class": "sr-only", text: " (abre o pagamento em nova aba)" })]);
    document.body.append(buy);
    if ("IntersectionObserver" in window) {
      var shown = [];
      var watch = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var i = shown.indexOf(e.target);
          if (e.isIntersecting && i < 0) shown.push(e.target);
          if (!e.isIntersecting && i >= 0) shown.splice(i, 1);
        });
        ctaInView = shown.length;
        onScroll();
      });
      [].forEach.call(document.querySelectorAll("main a.btn-cta[href]"), function (a) { watch.observe(a); });
    }
  }

  var onScroll = function () {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
    var past = window.scrollY > Math.max(600, window.innerHeight);
    if (toTop) toTop.classList.toggle("is-visible", past);
    if (buy) buy.classList.toggle("is-visible", past && !ctaInView);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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
    // Tocar fora do menu aberto também fecha.
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("open") && !nav.contains(e.target) && !btn.contains(e.target)) close();
    });
  }
})();
