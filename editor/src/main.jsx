import { createRoot } from "react-dom/client";

function App() {
  return <p>Editor React carregado.</p>;
}

createRoot(document.getElementById("editor-root")).render(<App />);
