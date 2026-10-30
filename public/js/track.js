/* Contagem de visitas e cliques em "comprar" (aba Resumo do painel). Sem cookies e sem nada de
   terceiros: manda só a página, o produto, a origem (utm_* do link ou o site de onde veio) e o
   servidor deduz o tipo de aparelho. A origem fica no sessionStorage (só esta aba, apagada ao
   fechá-la) para os cliques feitos depois de navegar pelo site também saberem de onde a pessoa veio.
   No clique em "comprar", os utm_* seguem no link da Kiwify: a venda chega lá com a origem. */
(function () {
  "use strict";
  if (document.documentElement.hasAttribute("data-editor")) return; // prévia do editor do painel

  var KEY = "origem";
  var TAGS = ["source", "medium", "campaign"];

  function readOrigin() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }

  // Origem da visita: link com utm_* tem prioridade; senão o site de onde veio (se não for este).
  function entryOrigin() {
    var params = new URLSearchParams(location.search), utm = {}, has = false;
    TAGS.forEach(function (t) {
      var v = params.get("utm_" + t);
      if (v) { utm[t] = v.slice(0, 100); has = true; }
    });
    var ref = "";
    try {
      var r = document.referrer ? new URL(document.referrer) : null;
      if (r && r.host !== location.host && /^https?:$/.test(r.protocol)) ref = r.hostname;
    } catch (e) { /* referrer inválido */ }
    var saved = readOrigin();
    // Mantém a origem de quem já está navegando pelo site; troca se chegou por um link novo.
    if (saved && !has && !ref) return saved;
    var origin = { utm: has ? utm : {}, ref: ref };
    try { sessionStorage.setItem(KEY, JSON.stringify(origin)); } catch (e) { /* armazenamento bloqueado */ }
    return origin;
  }
  var origin = entryOrigin();

  function send(type, product) {
    var body = JSON.stringify({
      type: type, path: location.pathname, product: product || undefined,
      ref: origin.ref || undefined, utm: origin.utm
    });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon("/api/track", body)) return;
      fetch("/api/track", { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } })
        .catch(function () {});
    } catch (e) { /* contagem nunca atrapalha a página */ }
  }

  // Produto da página (produto.html informa depois de carregar; /p/... o servidor descobre pelo endereço).
  var product = document.body ? document.body.getAttribute("data-product") : null;

  window.SiteTrack = {
    view: function (slug) { product = slug || product; send("view", product); }
  };
  // produto.html conta a visita só depois de carregar (ou de redirecionar para a página de vendas).
  if (!document.body || document.body.getAttribute("data-track") !== "manual") send("view", product);

  // Clique em "comprar": conta e leva a origem para o checkout da Kiwify.
  document.addEventListener("click", function (event) {
    var a = event.target.closest && event.target.closest("a.btn-cta");
    if (!a) return;
    send("checkout_click", product);
    try {
      var url = new URL(a.href);
      if (url.hostname === "pay.kiwify.com.br" && !url.searchParams.has("utm_source")) {
        TAGS.forEach(function (t) { if (origin.utm[t]) url.searchParams.set("utm_" + t, origin.utm[t]); });
        if (!origin.utm.source && origin.ref) url.searchParams.set("utm_source", origin.ref);
        a.href = url.toString();
      }
    } catch (e) { /* link inválido: segue como está */ }
  }, true);
})();
