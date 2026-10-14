// Ponto de entrada do editor React. Depende de window.Admin (public/admin/js/common.js),
// carregado antes: sessão, CSRF, diálogos de confirmação e seletor de imagens.
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/editor.css";

const productId = new URLSearchParams(location.search).get("id");
createRoot(document.getElementById("editor-root")).render(<App productId={productId} />);
