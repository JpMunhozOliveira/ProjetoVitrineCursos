// Compila o editor React para public/admin/editor/, onde o Express já serve o painel.
// Nomes fixos (editor.js / editor.css): o painel usa Cache-Control: no-store, então não há
// risco de o navegador guardar uma versão antiga.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../public/admin/editor",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: true, // facilita depurar no navegador (F12 mostra o código original)
    // Pastas do Windows montadas no Docker não avisam quando um arquivo muda: no modo dev
    // (docker-compose.override.yml) o observador confere os arquivos periodicamente.
    // (o Vite converte estas opções no formato do chokidar para o observador do Rolldown).
    watch: process.env.EDITOR_POLLING ? { chokidar: { usePolling: true, interval: 300 } } : undefined,
    rollupOptions: {
      input: "src/main.jsx",
      output: {
        entryFileNames: "editor.js",
        assetFileNames: "editor[extname]",
      },
    },
  },
});
