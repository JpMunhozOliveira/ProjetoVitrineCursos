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
    function sync() {
      var c = current();
      buttons.forEach(function (b, i) {
        b.setAttribute("aria-current", String(i === c));
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
  }

  [].forEach.call(document.querySelectorAll(".carousel"), setup);
})();
