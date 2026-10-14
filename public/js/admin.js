(function () {
  "use strict";
  var page = document.body.dataset.admin, csrf = null;
  var $ = function (id) { return document.getElementById(id); };

  async function api(path, opts) {
    opts = opts || {};
    var method = opts.method || "GET", headers = { Accept: "application/json" };
    if (opts.body) headers["Content-Type"] = "application/json";
    if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
    var res = await fetch("/api/admin" + path, {
      method: method, headers: headers, credentials: "same-origin",
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    var payload = null;
    try { payload = await res.json(); } catch (e) { /* 204 */ }
    if (!res.ok) {
      var err = new Error((payload && payload.error) || "Erro inesperado.");
      err.status = res.status; throw err;
    }
    return payload && payload.data;
  }

  if (page === "login") {
    api("/auth/me").then(function (d) { if (d.via === "session") location.replace("./"); }).catch(function () {});
    $("login-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = $("submit"), msg = $("msg");
      msg.textContent = ""; btn.disabled = true;
      try {
        await api("/auth/login", { method: "POST", body: { email: $("email").value, password: $("password").value } });
        location.replace("./");
      } catch (err) {
        msg.textContent = err.message; btn.disabled = false; $("password").select();
      }
    });
  }

  if (page === "panel") {
    var STATUS = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };
    (async function () {
      try {
        var who = await api("/auth/me");
        if (who.via !== "session") throw Object.assign(new Error(), { status: 401 });
        csrf = who.csrfToken; $("who").textContent = who.email;
        var courses = await api("/courses"), body = document.querySelector("#courses tbody");
        courses.forEach(function (c) {
          var tr = document.createElement("tr");
          [c.title, c.slug, STATUS[c.status] || c.status, new Date(c.updated_at).toLocaleString("pt-BR")]
            .forEach(function (t) { var td = document.createElement("td"); td.textContent = t; tr.append(td); });
          body.append(tr);
        });
        $("courses").hidden = !courses.length;
        $("msg").textContent = courses.length ? "" : "Nenhum curso cadastrado ainda.";
      } catch (err) {
        if (err.status === 401) return location.replace("login.html");
        $("msg").textContent = err.message; $("msg").classList.add("error");
      }
    })();
    $("logout").addEventListener("click", async function () {
      try { await api("/auth/logout", { method: "POST" }); } catch (e) { /* sai mesmo assim */ }
      location.replace("login.html");
    });
  }
})();
