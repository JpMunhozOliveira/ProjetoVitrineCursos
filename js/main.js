(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var S = window.SITE || {}, C = window.CURSOS || [];

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
  function renderCards(target, list) {
    target.textContent = "";
    if (!list.length) {
      target.append(el("p", { "class": "muted", text: "Nenhum curso encontrado. Tente outra busca ou categoria." }));
      return;
    }
    list.forEach(function (c) {
      var body = el("div", { "class": "card-body" }, [
        c.categoria ? el("p", { "class": "eyebrow", text: c.categoria }) : "",
        el("h3", { text: c.titulo }),
        el("p", { text: c.resumo }),
        c.publico ? el("p", { "class": "muted", text: c.publico }) : "",
        brl(c.preco) ? el("p", { "class": "price", text: brl(c.preco) }) : "",
        el("a", { "class": "btn btn-outline", href: "curso.html?id=" + encodeURIComponent(c.id),
                  "aria-label": "Ver detalhes: " + c.titulo, text: "Ver detalhes" })
      ]);
      target.append(el("article", { "class": "card" }, [cover(c), body]));
    });
  }
  var catalog = document.getElementById("catalogo");
  if (catalog && page === "home") {
    var feat = C.filter(function (c) { return c.destaque; });
    var shown = (feat.length ? feat : C).slice(0, 6);
    renderCards(catalog, shown);
    var all = document.getElementById("ver-todos");
    if (all && C.length <= shown.length) all.hidden = true;
  } else if (catalog) {
    var q = document.getElementById("busca"), sel = document.getElementById("categoria"),
        out = document.getElementById("resultado"), cats = [];
    C.forEach(function (c) { if (c.categoria && cats.indexOf(c.categoria) < 0) cats.push(c.categoria); });
    if (cats.length > 1) cats.forEach(function (t) { sel.append(el("option", { value: t, text: t })); });
    else document.getElementById("filtro-categoria").hidden = true;
    if (C.length < 4) document.getElementById("filtros").hidden = true; // poucos cursos: sem filtros
    var norm = function (t) { return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };
    var apply = function () {
      var term = norm(q.value), cat = sel.value;
      var list = C.filter(function (c) {
        return (!cat || c.categoria === cat) &&
          (!term || norm([c.titulo, c.resumo, c.publico, c.categoria].join(" ")).indexOf(term) >= 0);
      });
      renderCards(catalog, list);
      out.textContent = list.length + (list.length === 1 ? " curso encontrado" : " cursos encontrados");
    };
    q.addEventListener("input", apply);
    sel.addEventListener("change", apply);
    apply();
  }

  // Página de detalhes
  var box = document.getElementById("curso");
  if (box) {
    var id = new URLSearchParams(location.search).get("id");
    var c = C.filter(function (x) { return x.id === id; })[0];
    if (!c) {
      document.title = "Curso não encontrado — " + S.nome;
      box.append(el("h1", { text: "Curso não encontrado" }),
        el("p", {}, [el("a", { href: "catalogo.html", text: "Voltar ao catálogo" })]));
    } else {
      document.title = c.titulo + " — " + S.nome;
      var m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute("content", c.resumo || "");
      var facts = [["Formato", c.formato], ["Carga horária", c.cargaHoraria], ["Pré-requisitos", c.preRequisitos]]
        .filter(function (f) { return f[1]; })
        .map(function (f) { return el("li", {}, [el("strong", { text: f[0] + ": " }), f[1]]); });
      var main = el("div", {}, [
        el("a", { "class": "crumb", href: "catalogo.html", text: "← Todos os cursos" }),
        el("h1", { text: c.titulo }),
        el("p", { "class": "muted", text: c.resumo }),
        el("h2", { text: "Sobre o curso" }), el("p", { text: c.descricao }),
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
  }

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

  // Modo noturno (a preferência inicial é aplicada por theme.js)
  var tb = document.getElementById("tema-btn");
  if (tb) {
    var isDark = function () { return document.documentElement.getAttribute("data-theme") === "dark"; };
    tb.setAttribute("aria-pressed", String(isDark()));
    tb.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      tb.setAttribute("aria-pressed", String(next === "dark"));
      try { localStorage.setItem("tema", next); } catch (e) {}
    });
  }

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
