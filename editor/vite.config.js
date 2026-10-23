// Compila o editor React para public/admin/editor/, onde o Express já serve o painel.
// Nomes fixos (editor.js / editor.css): o servidor põe a versão na URL (?v=<hash do conteúdo>,
// ver server/lib/assets.js), então o navegador guarda o arquivo e baixa de novo só quando ele muda.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../public/admin/editor",
    emptyOutDir: true,
    cssCodeSplit: false,
    // Mapas do código-fonte (F12 mostra o código original) só no modo dev (npm run dev = --watch):
    // no build de produção, /admin/editor/*.map publicaria o código do editor para qualquer
    // visitante (a pasta é estática, sem login).
    sourcemap: process.argv.includes("--watch"),
    // Pastas do Windows montadas no Docker não avisam quando um arquivo muda: no modo dev
    // (docker-compose.override.yml) o observador confere os arquivos periodicamente.
    // (o Vite converte estas opções no formato do chokidar para o observador do Rolldown).
    watch: process.env.EDITOR_POLLING ? { chokidar: { usePolling: true, interval: 300 } } : undefined,
    rollupOptions: {
      input: "src/main.jsx",
      output: {
        // IIFE: script comum (não "module"), num arquivo só, carregado com defer depois do common.js.
        format: "iife",
        entryFileNames: "editor.js",
        assetFileNames: "editor[extname]",
      },
    },
  },
});
