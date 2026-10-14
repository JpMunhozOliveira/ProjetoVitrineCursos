/* ==========================================================
   COMPONENTES COMPARTILHADOS — cabeçalho/menu e rodapé.
   Edite aqui UMA vez e todas as páginas são atualizadas.
   Cada página só tem <div id="site-header"></div> e
   <div id="site-footer"></div> no lugar.
   Os textos com data-site (nome da marca) vêm de data/cursos.js.
   ========================================================== */
(function () {
  "use strict";

  var HEADER = `<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header">
  <div class="container header-row">
    <a class="brand" href="index.html" data-site="nome">Nome da Marca</a>
    <div class="header-actions">
      <nav id="nav" class="nav" aria-label="Principal">
        <ul>
          <li><a href="index.html">Início</a></li>
          <li><a href="catalogo.html">Catálogo</a></li>
          <li><a href="index.html#sobre">Sobre</a></li>
          <li><a href="index.html#contato">Contato</a></li>
        </ul>
      </nav>
      <button id="tema-btn" class="theme-btn" type="button" aria-pressed="false">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>
        <span>Modo noturno</span>
      </button>
      <button id="menu-btn" class="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
    </div>
  </div>
</header>`;

  var FOOTER = `<footer class="site-footer">
  <div class="container">
    <p><strong data-site="nome">Nome da Marca</strong> © <span data-year></span></p>
    <p>Pagamentos e acesso aos cursos processados pela Kiwify.</p>
  </div>
</footer>`;

  function mount(id, html) {
    var ph = document.getElementById(id);
    if (ph) ph.outerHTML = html;
  }
  mount("site-header", HEADER);
  mount("site-footer", FOOTER);

  // Marca no menu a página atual (acessibilidade + destaque visual)
  var current = { home: "index.html", catalogo: "catalogo.html", curso: "catalogo.html" }[document.body.dataset.page];
  document.querySelectorAll("#nav a").forEach(function (a) {
    if (a.getAttribute("href") === current) a.setAttribute("aria-current", "page");
  });
})();
