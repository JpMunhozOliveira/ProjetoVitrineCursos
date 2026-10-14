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

  // Botão "Modo noturno" (#tema-btn), usado no site e no painel. Este script roda no <head>,
  // antes do botão existir; por isso a ligação espera o carregamento da página.
  document.addEventListener("DOMContentLoaded", function () {
    var tb = document.getElementById("tema-btn");
    if (!tb) return;
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
