(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  // Já tem sessão? Vai direto para o painel.
  Admin.api("/auth/me").then(function (d) { if (d.via === "session") location.replace("./"); }).catch(function () {});

  $("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = $("submit"), msg = $("msg");
    msg.textContent = ""; btn.disabled = true;
    try {
      await Admin.api("/auth/login", { method: "POST", body: { email: $("email").value, password: $("password").value } });
      location.replace("./");
    } catch (err) {
      msg.textContent = err.message; btn.disabled = false; $("password").select();
    }
  });
})();
