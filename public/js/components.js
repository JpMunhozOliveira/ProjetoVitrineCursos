/* ==========================================================
   COMPONENTES COMPARTILHADOS — cabeçalho/menu e rodapé.
   Edite aqui UMA vez e todas as páginas são atualizadas.
   Cada página só tem <div id="site-header"></div> e
   <div id="site-footer"></div> no lugar.
   Os textos com data-site (nome da marca) vêm de data/site.js.
   ========================================================== */
(function () {
  "use strict";

  var HEADER = `<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header">
  <div class="container header-row">
    <a class="brand" href="/index.html"><span class="brand-mark" aria-hidden="true">E</span><span data-site="nome">Estratégia Contábil Digital</span></a>
    <div class="header-actions">
      <nav id="nav" class="nav" aria-label="Principal">
        <ul>
          <li><a href="/index.html">Início</a></li>
          <li><a href="/catalogo.html">Catálogo</a></li>
          <li><a href="/sobre.html">Sobre</a></li>
          <li><a href="/contato.html">Contato</a></li>
        </ul>
      </nav>
      <button id="tema-btn" class="theme-btn" type="button" aria-label="Modo noturno" title="Modo noturno" aria-pressed="false"></button>
      <button id="menu-btn" class="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
    </div>
  </div>
</header>`;

  var FOOTER = `<footer class="site-footer">
  <div class="container foot3">
    <div><p><strong data-site="nome">Estratégia Contábil Digital</strong> © <span data-year></span></p><p data-site="slogan"></p></div>
    <div><p><strong>Navegação</strong></p><p><a href="/catalogo.html">Catálogo</a></p><p><a href="/sobre.html">Sobre</a></p><p><a href="/contato.html">Contato</a></p></div>
    <div><p><strong>Compra segura</strong></p><p>Pagamentos e acesso aos cursos processados pela Kiwify.</p></div>
  </div>
</footer>`;

  function mount(id, html) {
    var ph = document.getElementById(id);
    if (ph) ph.outerHTML = html;
  }
  mount("site-header", HEADER);
  mount("site-footer", FOOTER);

  // Marca no menu a página atual (acessibilidade + destaque visual)
  var current = { home: "/index.html", catalogo: "/catalogo.html", produto: "/catalogo.html", sobre: "/sobre.html", contato: "/contato.html" }[document.body.dataset.page];
  document.querySelectorAll("#nav a").forEach(function (a) {
    if (a.getAttribute("href") === current) a.setAttribute("aria-current", "page");
  });
})();
