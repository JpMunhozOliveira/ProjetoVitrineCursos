# Vitrine de Cursos (placeholder)

Site estático (HTML + CSS + JS). Abra `index.html` no navegador ou publique em GitHub Pages.

## O que editar
| Quero mudar… | Arquivo |
|---|---|
| Cores, fonte, bordas | `css/theme.css` (variáveis no topo) |
| Nome da marca, slogan, bio, contatos | `data/cursos.js` → `window.SITE` |
| Cursos (título, conteúdo, preço, link Kiwify) | `data/cursos.js` → `window.CURSOS` |
| Imagens | `assets/images/` e referencie em `imagem` |

Para adicionar um curso, copie um bloco de `window.CURSOS` e troque o `id` (sem espaços/acentos).
O botão de compra só aparece se `checkoutUrl` começar com `https://`; caso contrário mostra "Compra em breve".

## Pendências antes de publicar
- Política de privacidade (ainda não criada), domínio e hospedagem.
- Validar cada link de checkout e testar teclado, contraste, Lighthouse e WAVE.
