(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  // Quem já tem sessão nem chega aqui: o servidor redireciona /admin/login.html para o painel.

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
