/* Resumo (página inicial do painel): visitas, cliques em "comprar" e vendas da Kiwify.
   Os números vêm prontos de /api/admin/dashboard; aqui só se desenha. Gráficos em SVG feitos à mão
   (a CSP do painel não carrega bibliotecas de fora). Textos sempre via textContent. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var msg = $("msg"), content = $("content"), tip = $("tip");
  var SVG = "http://www.w3.org/2000/svg";
  var data = null, loading = false;

  var nf = new Intl.NumberFormat("pt-BR");
  var compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
  var pct = function (v) { return (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"; };
  var num = function (n) { return n >= 10000 ? compact.format(n) : nf.format(n); };
  var dayLabel = function (iso) { var p = iso.split("-"); return p[2] + "/" + p[1]; };
  var DEVICES = { mobile: "Celular", desktop: "Computador", tablet: "Tablet" };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== "") n.append(c); });
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function fillTable(id, rows, empty) {
    var body = $(id).querySelector("tbody"), labels = [].map.call($(id).querySelectorAll("th"), function (th) { return th.textContent; });
    body.textContent = "";
    if (!rows.length) {
      body.append(el("tr", {}, [el("td", { colspan: String(labels.length), "class": "muted", text: empty })]));
      return;
    }
    rows.forEach(function (cells) {
      body.append(el("tr", {}, cells.map(function (c, i) {
        return el("td", { "data-label": labels[i] }, [c instanceof Node ? c : String(c)]);
      })));
    });
  }

  /* ---------- Indicadores do período ---------- */
  function delta(cur, prev) {
    if (!prev) return null;
    var d = (cur - prev) / prev;
    if (Math.abs(d) < 0.005) return el("span", { "class": "tile-delta", text: "= igual ao período anterior" });
    var up = d > 0;
    return el("span", { "class": "tile-delta " + (up ? "is-up" : "is-down") },
      [(up ? "↑ " : "↓ ") + pct(Math.abs(d)) + " vs. período anterior"]);
  }
  function tile(label, value, sub, d) {
    return el("div", { "class": "tile" }, [
      el("span", { "class": "tile-label", text: label }),
      el("strong", { "class": "tile-value", text: value }),
      sub ? el("span", { "class": "tile-sub", text: sub }) : null,
      d
    ]);
  }
  function renderTiles(t, p) {
    var box = $("tiles");
    box.textContent = "";
    var rate = t.visits ? t.clickers / t.visits : 0, conv = t.visits ? t.sales / t.visits : 0;
    var prevConv = p.visits ? p.sales / p.visits : 0;
    box.append(
      tile("Visitas", num(t.visits), nf.format(t.views) + " páginas vistas", delta(t.visits, p.visits)),
      tile("Cliques em comprar", num(t.clicks), t.visits ? pct(rate) + " das visitas clicaram" : null, delta(t.clicks, p.clicks)),
      tile("Vendas", num(t.sales), t.refunds ? nf.format(t.refunds) + " reembolso(s) ou chargeback(s)" : null, delta(t.sales, p.sales)),
      tile("Faturamento líquido", Admin.formatPrice(t.revenue_cents), "o que fica para você, após as taxas", delta(t.revenue_cents, p.revenue_cents)),
      tile("Conversão", t.visits ? pct(conv) : "—", "vendas ÷ visitas", prevConv && t.visits ? delta(conv, prevConv) : null)
    );
  }

  /* ---------- Gráficos de colunas (um por medida: escalas diferentes não dividem um eixo) ---------- */
  function niceMax(max) {
    if (max <= 4) return 4;
    var step = max / 2, pow = Math.pow(10, Math.floor(Math.log10(step))), f = step / pow;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return Math.ceil(nice * pow) * 2;
  }
  function roundedTop(x, y, w, h) {
    var r = Math.min(4, w / 2, h);
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y +
      "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
  }
  function showTip(html, x, y) {
    tip.textContent = "";
    tip.append(el("strong", { text: html[0] }), el("span", { text: html[1] }));
    tip.hidden = false;
    var w = tip.offsetWidth, left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
    tip.style.left = left + "px";
    tip.style.top = Math.max(8, y - tip.offsetHeight - 10) + "px";
  }
  function hideTip() { tip.hidden = true; }

  function columnChart(fig, title, key, unit, days) {
    fig.textContent = "";
    var values = days.map(function (d) { return d[key]; });
    var total = values.reduce(function (a, b) { return a + b; }, 0);
    fig.append(el("figcaption", {}, [el("span", { text: title }), el("strong", { text: nf.format(total) })]));
    var W = Math.max(240, fig.clientWidth), H = 150, L = 34, R = 4, T = 8, B = 22;
    var pw = W - L - R, ph = H - T - B, n = values.length, band = pw / n;
    var bw = Math.max(2, Math.min(24, band - 2)), top = niceMax(Math.max.apply(null, values));
    var best = values.indexOf(Math.max.apply(null, values));
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", tabindex: "0",
      "aria-label": title + " por dia: " + nf.format(total) + " no período" + (total ? ", maior dia " + dayLabel(days[best].day) + " com " + nf.format(values[best]) : "") + ". Use as setas para ver cada dia." });
    [0, top / 2, top].forEach(function (v) {
      var y = T + ph - (v / top) * ph;
      svg.append(svgEl("line", { "class": "grid", x1: L, x2: W - R, y1: y, y2: y }));
      var t = svgEl("text", { "class": "axis", x: L - 6, y: y + 4, "text-anchor": "end" });
      t.textContent = v >= 1000 ? compact.format(v) : String(v);
      svg.append(t);
    });
    var bars = values.map(function (v, i) {
      var h = (v / top) * ph, x = L + i * band + (band - bw) / 2;
      var p = svgEl("path", { "class": "bar", d: v ? roundedTop(x, T + ph - h, bw, h) : "" });
      svg.append(p);
      return p;
    });
    var ticks = n <= 7 ? values.map(function (_, i) { return i; }) : [0, Math.floor((n - 1) / 2), n - 1];
    ticks.forEach(function (i) {
      var t = svgEl("text", { "class": "axis", x: L + i * band + band / 2, y: H - 6,
        "text-anchor": n > 7 && i === 0 ? "start" : n > 7 && i === n - 1 ? "end" : "middle" });
      if (n > 7 && i === 0) t.setAttribute("x", L);
      if (n > 7 && i === n - 1) t.setAttribute("x", W - R);
      t.textContent = dayLabel(days[i].day);
      svg.append(t);
    });
    var hit = svgEl("rect", { x: L, y: T, width: pw, height: ph, fill: "transparent" });
    svg.append(hit);
    fig.append(svg);

    var active = -1;
    function focus(i) {
      if (active >= 0) bars[active].classList.remove("is-active");
      active = i;
      bars[i].classList.add("is-active");
      var r = svg.getBoundingClientRect(), scale = r.width / W;
      var y = r.top + (T + ph - (values[i] / top) * ph) * scale;
      showTip([nf.format(values[i]) + " " + (values[i] === 1 ? unit[0] : unit[1]), dayLabel(days[i].day)],
        r.left + (L + i * band + band / 2) * scale, y);
    }
    function blur() { if (active >= 0) bars[active].classList.remove("is-active"); active = -1; hideTip(); }
    svg.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
      var i = Math.floor((x - L) / band);
      if (i < 0 || i >= n) return blur();
      if (i !== active) focus(i);
    });
    svg.addEventListener("pointerleave", blur);
    svg.addEventListener("blur", blur);
    svg.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      var i = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : active < 0 ? n - 1 : active + (e.key === "ArrowRight" ? 1 : -1);
      focus(Math.max(0, Math.min(n - 1, i)));
    });
  }

  var CHARTS = [
    ["Visitas", "visits", ["visita", "visitas"]],
    ["Cliques em comprar", "clicks", ["clique", "cliques"]],
    ["Vendas", "sales", ["venda", "vendas"]]
  ];
  function renderCharts() {
    var box = $("charts");
    if (!box.children.length) CHARTS.forEach(function () { box.append(el("figure", { "class": "dash-chart" })); });
    CHARTS.forEach(function (c, i) { columnChart(box.children[i], c[0], c[1], c[2], data.daily); });
  }

  /* ---------- Listas com barra (aparelhos, páginas) ---------- */
  function barList(id, rows, empty) {
    var ul = $(id), max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat(1));
    var total = rows.reduce(function (a, r) { return a + r.value; }, 0);
    ul.textContent = "";
    if (!rows.length) { ul.append(el("li", { "class": "muted", text: empty })); return; }
    rows.forEach(function (r) {
      var bar = el("span", { "class": "dash-bar" });
      bar.style.width = Math.max(2, (r.value / max) * 100) + "%";
      ul.append(el("li", {}, [
        el("span", { "class": "dash-bar-label", text: r.label }),
        el("span", { "class": "dash-bar-track" }, [bar]),
        el("span", { "class": "dash-bar-value", text: nf.format(r.value) + (r.share ? " (" + pct(r.value / total) + ")" : "") })
      ]));
    });
  }
  function pageName(path, slugs) {
    if (path === "/" || path === "/index.html") return "Início";
    var m = /^\/p\/(.+)$/.exec(path);
    if (m) return slugs[m[1]] || m[1];
    var names = { "/catalogo.html": "Catálogo", "/produto.html": "Detalhes de produto", "/sobre.html": "Sobre",
      "/contato.html": "Contato", "/duvidas.html": "Dúvidas", "/termos.html": "Termos de uso", "/privacidade.html": "Privacidade" };
    return names[path] || path;
  }

  /* ---------- Página toda ---------- */
  function render() {
    var d = data, slugs = {};
    d.products.forEach(function (p) { if (p.slug) slugs[p.slug] = p.title; });
    renderTiles(d.totals, d.previous);
    var fmt = function (iso) { return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }); };
    $("period").textContent = "De " + fmt(d.start) + " até hoje. Comparação com os " + d.days + " dias anteriores. Visitas = pessoas diferentes por dia." +
      (d.brand ? " Com uma empresa escolhida, contam só as visitas às páginas dos produtos dela (início e catálogo ficam de fora)." : "");
    $("empty").hidden = d.has_events;
    renderCharts();

    fillTable("daily-table", d.daily.slice().reverse().map(function (r) {
      return [dayLabel(r.day), nf.format(r.visits), nf.format(r.clicks), nf.format(r.sales)];
    }), "Sem dados.");

    fillTable("products", d.products.map(function (p) {
      var name = p.id ? el("a", { href: "produto.html?id=" + encodeURIComponent(p.id), text: p.title }) : el("span", { "class": "muted", text: p.title });
      return [name, nf.format(p.visits), nf.format(p.clicks), p.visits ? pct(Math.min(1, p.clicks / p.visits)) : "—",
        nf.format(p.sales), p.revenue_cents ? Admin.formatPrice(p.revenue_cents) : "—"];
    }), "Nenhum produto publicado ainda.");

    fillTable("sources", d.sources.map(function (s) {
      var known = Admin.UTM_SOURCES.find(function (u) { return u.value === s.source; });
      return [known ? known.label : s.source, nf.format(s.visits), nf.format(s.clicks), nf.format(s.sales), s.revenue_cents ? Admin.formatPrice(s.revenue_cents) : "—"];
    }), "Nenhuma visita no período.");

    barList("devices", d.devices.map(function (r) { return { label: DEVICES[r.device] || r.device, value: r.visits, share: true }; }), "Nenhuma visita no período.");
    barList("pages", d.pages.map(function (r) { return { label: pageName(r.path, slugs), value: r.views }; }), "Nenhuma visita no período.");

    $("kiwify-box").hidden = !d.kiwify.length;
    $("refresh").hidden = !d.kiwify.length;
    fillTable("kiwify", d.kiwify.map(function (k) {
      var synced = k.sync_error ? el("span", { "class": "hint warn", text: k.sync_error })
        : k.synced_at ? new Date(k.synced_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Ainda não";
      return [k.brand, nf.format(k.paid), nf.format(k.pix) + " · " + nf.format(k.card) + " · " + nf.format(k.boleto),
        nf.format(k.waiting), nf.format(k.refused), nf.format(k.refunds), synced];
    }), "");

    var warn = $("warnings");
    warn.textContent = "";
    d.warnings.forEach(function (w) {
      warn.append(el("li", {}, [el("a", { href: "produto.html?id=" + encodeURIComponent(w.product_id), text: w.title }), ": " + w.message]));
    });
    warn.hidden = !d.warnings.length;
  }

  function days() { var c = document.querySelector('input[name="days"]:checked'); return c ? c.value : "30"; }
  // Troca de empresa (Admin.brandSwitch, em common.js): "" = todas.
  var brand = function () { return ""; };

  async function load() {
    if (loading) return;
    loading = true;
    content.classList.add("is-loading");
    try {
      data = await Admin.api("/dashboard?days=" + days() + (brand() ? "&brand=" + encodeURIComponent(brand()) : ""));
      content.hidden = false; // antes de desenhar: os gráficos medem a largura disponível
      render();
      Admin.showMessage(msg, "");
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    } finally {
      loading = false;
      content.classList.remove("is-loading");
    }
  }

  document.querySelectorAll('input[name="days"]').forEach(function (r) { r.addEventListener("change", load); });

  $("refresh").addEventListener("click", async function () {
    var btn = this;
    btn.disabled = true;
    Admin.showMessage(msg, "Buscando vendas na Kiwify…");
    try {
      var r = await Admin.api("/dashboard/refresh", { method: "POST" });
      await load();
      Admin.showMessage(msg, r.failed ? "Algumas contas não puderam ser atualizadas (veja a tabela da Kiwify)." : "Vendas atualizadas.", r.failed ? "error" : "success");
    } catch (err) {
      Admin.showMessage(msg, err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  // Redesenha os gráficos quando a largura muda (girar o celular, redimensionar a janela).
  var lastWidth = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(function (entries) {
      var w = Math.round(entries[0].contentRect.width);
      if (data && w !== lastWidth) { lastWidth = w; renderCharts(); }
    }).observe($("charts"));
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  Admin.requireSession()
    .then(function () { return Admin.api("/brands").catch(function () { return []; }); })
    .then(function (list) {
      brand = Admin.brandSwitch($("brands"), list, load, { title: function (name) { return "Ver só os números de " + name; } });
      return load();
    })
    .catch(function (err) { Admin.showMessage(msg, err.message, "error"); });
})();
