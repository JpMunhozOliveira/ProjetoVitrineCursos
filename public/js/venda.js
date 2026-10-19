(function () {
  "use strict";
  // Carrossel: setas e pontos são opcionais, a rolagem já funciona sozinha.
  // Vale para todos os .carousel da página (uma página de vendas pode ter mais de uma galeria).
  var reduce =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    // Ponto atual e destaque do slide central (os laterais ficam menores, ver venda.css).
    function sync() {
      var c = current();
      buttons.forEach(function (b, i) {
        b.setAttribute("aria-current", String(i === c));
        slides[i].classList.toggle("is-current", i === c);
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
        window.requestAnimationFrame(sync);
      },
      { passive: true },
    );
    track.tabIndex = 0; // permite usar as setas do teclado para rolar
    sync();
    root.classList.add("is-ready");
  }

  [].forEach.call(document.querySelectorAll(".carousel"), setup);

  // Animações ao rolar: títulos, cartões e itens surgem suavemente ao entrar na tela.
  // Fora quando a pessoa pede menos movimento e dentro do editor do painel (<html data-editor>),
  // onde a página é redesenhada a cada mudança e nada pode ficar escondido.
  if (reduce || !("IntersectionObserver" in window) || document.documentElement.hasAttribute("data-editor")) return;

  var SELECTOR = [
    ".v-section .v-eyebrow", ".v-section h2", ".v-card", ".grid8 > li", ".who > li", ".v-quote",
    ".faq", ".seals > li", ".banner", ".author-photo", ".carousel", ".v-strip-row", ".offer-panel",
  ].join(",");
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
    if (index > 0) el.style.setProperty("--reveal-delay", Math.min(index, MAX_STEPS) * STEP + "ms");
    el.classList.add("reveal");
    el.addEventListener("transitionend", done);
    observer.observe(el);
  });
})();
