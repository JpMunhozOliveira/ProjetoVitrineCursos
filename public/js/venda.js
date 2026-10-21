(function () {
  "use strict";
  // Carrossel: setas e pontos são opcionais, a rolagem já funciona sozinha.
  // Vale para todos os .carousel da página (uma página de vendas pode ter mais de uma galeria).
  var reduce =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Dentro do editor do painel (<html data-editor>) a página é só uma prévia editável.
  var editing = document.documentElement.hasAttribute("data-editor");

  // Botão "voltar": quem veio de outra página do site volta para ela (mantém filtros e rolagem
  // do catálogo); quem abriu o link direto (anúncio, WhatsApp...) segue o href, o catálogo.
  var back = document.querySelector("[data-back]");
  if (back) {
    back.addEventListener("click", function (event) {
      var fromSite = false;
      try { fromSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
      if (fromSite && history.length > 1) {
        event.preventDefault();
        history.back();
      }
    });
    // Depois de rolar, vira só a seta (cobre menos o conteúdo).
    var compact = function () { back.classList.toggle("is-compact", window.scrollY > 120); };
    window.addEventListener("scroll", compact, { passive: true });
    compact();
  }

  function setup(root) {
    var track = root.querySelector(".track"),
      dots = root.querySelector(".dots");
    if (!track || !dots) return;
    var slides = [].slice.call(track.children);
    var prev = root.querySelector(".prev"),
      next = root.querySelector(".next");
    if (slides.length < 2) return; // um slide só: sem setas nem pontos
    prev.hidden = next.hidden = dots.hidden = false;

    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({
        left:
          slides[i].offsetLeft - (track.clientWidth - slides[i].clientWidth) / 2,
        behavior: reduce ? "auto" : "smooth",
      });
    }
    function current() {
      var mid = track.scrollLeft + track.clientWidth / 2,
        best = 0,
        d = Infinity;
      slides.forEach(function (s, i) {
        var diff = Math.abs(s.offsetLeft + s.clientWidth / 2 - mid);
        if (diff < d) {
          d = diff;
          best = i;
        }
      });
      return best;
    }
    var buttons = slides.map(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Ir para o slide " + (i + 1));
      b.addEventListener("click", function () {
        go(i);
      });
      dots.append(b);
      return b;
    });
    // Escala das vizinhas e das mais distantes, quanto da vizinha fica escondido atrás da imagem
    // atual e quanto da mais distante aparece além da vizinha.
    var NEAR = 0.8, FAR = 0.62, HIDDEN = 0.35, PEEK = 0.3;
    // Largura em que a imagem aparece no slide (inteira, sem cortes), calculada pelas dimensões
    // do <img>: não depende de a imagem já ter carregado.
    function imageWidth(slide) {
      var img = slide.querySelector("img"), box = slide.clientWidth, h = slide.clientHeight;
      var w = img && +img.getAttribute("width"), ih = img && +img.getAttribute("height");
      if (!w || !ih) return box;
      return Math.min(box, h * w / ih, w);
    }
    // Profundidade: as vizinhas ficam menores, mais apagadas e encostadas na imagem atual,
    // parcialmente atrás dela. O efeito acompanha a rolagem quadro a quadro: a posição na rolagem
    // vira um índice fracionário (ex.: 1.4) e cada imagem fica entre o arranjo "atual = 1" e o
    // arranjo "atual = 2", na proporção do caminho já percorrido. Assim nada anda por conta
    // própria (sem transição) e as imagens não passam do ponto nem voltam no fim da rolagem.
    // O deslocamento vai na imagem (filho do <li>), não no <li>: mexer no <li> mudaria o snap.
    var LOOK = [
      { scale: 1, bright: 1, sat: 1, op: 1 },
      { scale: NEAR, bright: 0.62, sat: 0.8, op: 1 },
      { scale: FAR, bright: 0.45, sat: 0.6, op: 0.55 },
    ];
    var widths = [], step = 0;
    function measure() {
      widths = slides.map(imageWidth);
      step = slides[1].offsetLeft - slides[0].offsetLeft; // há sempre 2 ou mais slides aqui
    }
    // Distância visual (do centro da atual c ao centro do slide i) no arranjo com c no meio.
    function offset(i, c) {
      var d = i - c, dir = d < 0 ? -1 : 1, n = Math.abs(d);
      if (n === 0) return 0;
      var near = widths[c + dir] * NEAR;
      var dist = widths[c] / 2 + near / 2 - near * HIDDEN;
      if (n === 1) return dir * dist;
      var far = widths[c + 2 * dir] !== undefined ? widths[c + 2 * dir] * FAR : near;
      dist += near / 2 - far / 2 + far * PEEK; // aparece um pouco além da vizinha
      if (n === 2) return dir * dist;
      return dir * (dist + (n - 2) * step); // mais longe: segue a rolagem, fora de vista
    }
    function lerp(a, b, t) { return a + (b - a) * t; }
    var shown = -1;
    function render() {
      if (!step) return;
      var mid = track.scrollLeft + track.clientWidth / 2;
      var x = (mid - (slides[0].offsetLeft + slides[0].offsetWidth / 2)) / step;
      x = Math.max(0, Math.min(slides.length - 1, x));
      var k = Math.min(slides.length - 2, Math.floor(x)), t = x - k;
      slides.forEach(function (s, i) {
        var visual = lerp(offset(i, k), offset(i, k + 1), t);
        var natural = (i - x) * step;
        var n = Math.min(2, Math.abs(i - x)), lo = Math.floor(n), f = n - lo;
        var A = LOOK[lo], B = LOOK[Math.min(2, lo + 1)];
        var transform = "translateX(" + (visual - natural).toFixed(1) + "px) scale(" + lerp(A.scale, B.scale, f).toFixed(3) + ")";
        var filter = "brightness(" + lerp(A.bright, B.bright, f).toFixed(3) + ") saturate(" + lerp(A.sat, B.sat, f).toFixed(3) + ")";
        var opacity = lerp(A.op, B.op, f).toFixed(3);
        s.style.zIndex = String(3 - Math.min(3, Math.round(Math.abs(i - x))));
        // A imagem e, no editor, o botão × do slide andam juntos.
        [].forEach.call(s.children, function (child) {
          child.style.transform = transform;
          child.style.filter = filter;
          child.style.opacity = opacity;
        });
      });
      // Ponto atual e data-pos (cursor de clique nas vizinhas): só quando o atual muda.
      var c = Math.round(x);
      if (c === shown) return;
      shown = c;
      buttons.forEach(function (b, i) {
        var d = i - c;
        b.setAttribute("aria-current", String(d === 0));
        if (d === 0) slides[i].removeAttribute("data-pos");
        else slides[i].setAttribute("data-pos", (Math.abs(d) > 1 ? "far-" : "") + (d < 0 ? "prev" : "next"));
      });
    }
    var pending = false;
    function sync(force) {
      if (force === true) measure();
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () { pending = false; render(); });
    }
    window.addEventListener("resize", function () { sync(true); });
    // Clicar na imagem vizinha (parcialmente atrás da atual) leva até ela. No editor, clicar numa
    // imagem serve para trocá-la, então fica de fora.
    if (!editing) {
      slides.forEach(function (s, i) {
        s.addEventListener("click", function () { if (i !== current()) go(i); });
      });
    }
    prev.addEventListener("click", function () {
      go(current() - 1);
    });
    next.addEventListener("click", function () {
      go(current() + 1);
    });
    track.addEventListener(
      "scroll",
      function () {
        sync();
      },
      { passive: true },
    );
    track.tabIndex = 0; // permite usar as setas do teclado para rolar
    sync(true);
    root.classList.add("is-ready");
  }

  [].forEach.call(document.querySelectorAll(".carousel"), setup);

  // Perguntas frequentes: abrir e fechar deslizando, em vez de saltar. Sem JavaScript, com
  // "menos movimento" ou dentro do editor (onde ficam sempre abertas), o <details> funciona sozinho.
  function accordion(details) {
    var summary = details.querySelector("summary"), running = null;
    if (!summary || !details.animate) return;
    function finish(open) {
      details.open = open;
      details.classList.remove("is-closing");
      details.style.height = details.style.overflow = "";
      running = null;
    }
    function slide(from, to, open) {
      details.style.overflow = "hidden";
      if (running) running.cancel();
      running = details.animate({ height: [from + "px", to + "px"] }, { duration: 280, easing: "cubic-bezier(.2,.7,.2,1)" });
      running.onfinish = function () { finish(open); };
    }
    summary.addEventListener("click", function (event) {
      event.preventDefault();
      var start = details.offsetHeight;
      if (details.open && !details.classList.contains("is-closing")) {
        details.classList.add("is-closing"); // o "+" volta a girar já no início
        slide(start, summary.offsetHeight + 2, false);
      } else {
        details.classList.remove("is-closing");
        details.open = true;
        slide(start, details.scrollHeight + 2, true);
      }
    });
  }
  if (!reduce && !editing) [].forEach.call(document.querySelectorAll("details.faq"), accordion);

  // Animações ao rolar: títulos, cartões e itens surgem suavemente ao entrar na tela.
  // Fora quando a pessoa pede menos movimento e dentro do editor do painel (<html data-editor>),
  // onde a página é redesenhada a cada mudança e nada pode ficar escondido.
  if (reduce || !("IntersectionObserver" in window) || editing) return;

  var SELECTOR = [
    ".v-section .v-eyebrow", ".v-section h2", ".v-section .v-intro", ".v-card", ".grid8 > li", ".who > li", ".v-quote",
    ".faq", ".seals > li", ".banner", ".author-photo", ".carousel", ".v-strip-row", ".link-list > li",
    ".offer-main > *", ".buy-card",
  ].join(",");
  // O cartão de compra (preço e botão) entra sem esperar a cascata dos outros itens.
  var NO_DELAY = ".buy-card";
  var STEP = 70, MAX_STEPS = 6; // itens de uma mesma grade entram em cascata

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      entry.target.classList.add("is-in");
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

  // Terminada a entrada, a classe sai: os cartões voltam à própria transição (efeito ao passar o mouse).
  function done(event) {
    var el = event.currentTarget;
    if (event.target !== el || !el.classList.contains("is-in")) return;
    el.classList.remove("reveal", "is-in");
    el.style.removeProperty("--reveal-delay");
    el.removeEventListener("transitionend", done);
  }

  var fold = window.innerHeight;
  [].forEach.call(document.querySelectorAll(SELECTOR), function (el) {
    // O que já aparece ao abrir a página não é animado (não atrasa a primeira dobra).
    if (el.getBoundingClientRect().top < fold) return;
    if (el.parentElement && el.parentElement.closest(SELECTOR)) return; // já entra junto com o cartão em volta
    var index = el.parentElement ? [].indexOf.call(el.parentElement.children, el) : 0;
    if (index > 0 && !el.matches(NO_DELAY)) el.style.setProperty("--reveal-delay", Math.min(index, MAX_STEPS) * STEP + "ms");
    el.classList.add("reveal");
    el.addEventListener("transitionend", done);
    observer.observe(el);
  });
})();
