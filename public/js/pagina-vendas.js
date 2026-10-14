(function () {
  "use strict";

  var headline = document.getElementById("sales-headline");
  var subheadline = document.getElementById("sales-subheadline");
  var label = document.getElementById("sales-course-label");
  var status = document.getElementById("sales-status");
  var target = document.getElementById("sales-sections");

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function renderSection(section) {
    var wrapper = element("section", "sales-section");
    var title = typeof section.title === "string" ? section.title : "";
    if (title) wrapper.append(element("h2", "", title));

    var items = Array.isArray(section.items) ? section.items : [];
    if (section.type === "faq") {
      items.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        var details = element("details", "sales-faq");
        details.append(element("summary", "", item.question || "Pergunta"));
        details.append(element("p", "", item.answer || ""));
        wrapper.append(details);
      });
      return wrapper;
    }

    if (items.length) {
      var list = element("ul", "sales-list");
      items.forEach(function (item) {
        if (typeof item === "string") {
          list.append(element("li", "", item));
        } else if (item && typeof item === "object") {
          var li = element("li", "", "");
          if (item.title || item.question) {
            li.append(element("strong", "", item.title || item.question));
          }
          if (item.description || item.answer) {
            li.append(element("p", "", item.description || item.answer));
          }
          if (!item.title && !item.question && !item.description && !item.answer) return;
          list.append(li);
        }
      });
      wrapper.append(list);
    }

    if (typeof section.text === "string" && section.text.trim()) {
      wrapper.append(element("p", "sales-paragraph", section.text));
    }
    return wrapper;
  }

  async function loadSalesPage() {
    var slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      headline.textContent = "Curso não encontrado";
      status.textContent = "O endereço não contém um identificador de curso válido.";
      return;
    }

    try {
      var response = await fetch("/api/products/" + encodeURIComponent(slug) + "/sales-page", {
        headers: { "Accept": "application/json" }
      });
      var payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar esta página.");

      var course = payload.data;
      document.title = (course.seo_title || course.headline || course.product_title) + " | Vitrine de Cursos";
      var description = document.querySelector('meta[name="description"]');
      if (description && course.seo_description) description.content = course.seo_description;

      label.textContent = course.product_title || "Curso";
      headline.textContent = course.headline || course.product_title || "Conheça este curso";
      subheadline.textContent = course.subheadline || course.short_description || "";
      status.textContent = "";
      status.hidden = true;

      var sections = Array.isArray(course.sections) ? course.sections : [];
      if (!sections.length) {
        status.hidden = false;
        status.textContent = "O conteúdo detalhado deste curso ainda não foi cadastrado.";
      }
      sections.forEach(function (section) {
        if (section && typeof section === "object" && !Array.isArray(section)) {
          target.append(renderSection(section));
        }
      });
    } catch (error) {
      headline.textContent = "Não foi possível carregar o curso";
      status.hidden = false;
      status.textContent = error.message || "Ocorreu um erro inesperado.";
    }
  }

  loadSalesPage();
})();
