(function () {
  "use strict";
  document.documentElement.classList.add("js"); // libera os esqueletos de carregamento
  var saved = null;
  try { saved = localStorage.getItem("tema"); } catch (e) {}
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function system() { return mq && mq.matches ? "dark" : "light"; }
  document.documentElement.setAttribute("data-theme", saved === "dark" || saved === "light" ? saved : system());
  // Sem escolha salva, acompanha mudanças do sistema
  if (mq && !saved && mq.addEventListener) {
    mq.addEventListener("change", function () {
      var s = null; try { s = localStorage.getItem("tema"); } catch (e) {}
      if (!s) {
        document.documentElement.setAttribute("data-theme", system());
        var b = document.getElementById("tema-btn");
        if (b) b.setAttribute("aria-pressed", String(system() === "dark"));
      }
    });
  }

  // Ícone do botão: sol no tema claro, lua no escuro. A troca animada é feita pelo CSS (.theme-icon).
  var ICON = '<svg class="theme-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<g class="sun" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g>' +
    '<path class="moon" fill="currentColor" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  // Botão "Modo noturno" (#tema-btn), usado no site e no painel. Este script roda no <head>,
  // antes do botão existir; por isso a ligação espera o carregamento da página.
  document.addEventListener("DOMContentLoaded", function () {
    var tb = document.getElementById("tema-btn");
    if (!tb) return;
    tb.innerHTML = ICON;
    var isDark = function () { return document.documentElement.getAttribute("data-theme") === "dark"; };
    tb.setAttribute("aria-pressed", String(isDark()));
    tb.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      tb.setAttribute("aria-pressed", String(next === "dark"));
      try { localStorage.setItem("tema", next); } catch (e) {}
    });
  });
})();
