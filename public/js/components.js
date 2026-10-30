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
    <a class="brand" href="/index.html"><img class="brand-mark" src="/assets/favicon/favicon.png" alt="" width="32" height="32"><span data-site="nome">Celetivo Cursos</span></a>
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
      <button id="menu-btn" class="menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav"><span></span></button>
    </div>
  </div>
</header>`;

  var FOOTER = `<footer class="site-footer">
  <div class="container foot3 foot4">
    <div><p><strong data-site="nome">Celetivo Cursos</strong> © <span data-year></span></p><p data-site="slogan"></p></div>
    <nav aria-label="Rodapé: navegação"><p><strong>Navegação</strong></p><p><a href="/catalogo.html">Catálogo</a></p><p><a href="/sobre.html">Sobre</a></p><p><a href="/contato.html">Contato</a></p></nav>
    <nav aria-label="Rodapé: ajuda"><p><strong>Ajuda</strong></p><p><a href="/duvidas.html">Dúvidas frequentes</a></p><p><a href="/termos.html">Termos de uso</a></p><p><a href="/privacidade.html">Política de privacidade</a></p></nav>
    <div><p><strong>Compra segura</strong></p><p>Pagamentos e acesso aos cursos processados pela Kiwify.</p></div>
  </div>
</footer>`;

  function mount(id, html) {
    var ph = document.getElementById(id);
    if (ph) ph.outerHTML = html;
  }

  // Marca do professor: a página de vendas manda nome e logo em data-brand-* no
  // placeholder do cabeçalho (ver server/sales/render.js). Sem eles, fica a marca do site.
  // Os textos entram por textContent/setAttribute, nunca como HTML.
  var placeholder = document.getElementById("site-header");
  var brand = placeholder && placeholder.hasAttribute("data-brand-name") ? {
    name: placeholder.dataset.brandName,
    logo: placeholder.dataset.brandLogo,
    width: placeholder.dataset.brandLogoW,
    height: placeholder.dataset.brandLogoH,
    alt: placeholder.dataset.brandLogoAlt
  } : null;

  mount("site-header", HEADER);

  // Página de vendas: menu enxuto (sem "Início") para manter a pessoa na oferta;
  // ficam Catálogo, Sobre e Contato.
  if (document.body.dataset.page === "venda") {
    var home = document.querySelector('#nav a[href="/index.html"]');
    if (home) home.parentNode.remove();
  }
  mount("site-footer", FOOTER);

  if (brand) {
    var link = document.querySelector(".site-header .brand");
    var mark = link.querySelector(".brand-mark"), label = link.querySelector("[data-site]");
    if (brand.logo) {
      mark.src = brand.logo;
      mark.className = "brand-logo";
      if (brand.width && brand.height) { mark.width = brand.width; mark.height = brand.height; }
      // Só logo, sem nome: o logo é o nome do link.
      mark.alt = brand.name ? "" : brand.alt || "Início";
    }
    if (brand.name) {
      label.removeAttribute("data-site"); // main.js não troca pelo nome do site
      label.textContent = brand.name;
    } else if (brand.logo) {
      label.remove();
    }
  }

  // Marca no menu a página atual (acessibilidade + destaque visual)
  var current = { home: "/index.html", catalogo: "/catalogo.html", produto: "/catalogo.html", sobre: "/sobre.html", contato: "/contato.html" }[document.body.dataset.page];
  document.querySelectorAll("#nav a").forEach(function (a) {
    if (a.getAttribute("href") === current) a.setAttribute("aria-current", "page");
  });
})();
