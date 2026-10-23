// Ponto de entrada do editor React. Depende de window.Admin (public/admin/js/common.js),
// carregado antes: sessão, CSRF, diálogos de confirmação e seletor de imagens.
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/editor.css";

// pagina.html?id=<produto>: página de vendas do produto. pagina.html?bloco=<id>: um bloco salvo.
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("editor-root")).render(<App productId={params.get("id")} sharedId={params.get("bloco")} />);
