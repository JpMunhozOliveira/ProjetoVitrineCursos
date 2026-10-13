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
})();
