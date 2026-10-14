# Progresso — 14/10/2026

Resumo do dia de desenvolvimento da plataforma de catálogo e páginas de vendas: o que foi feito, as decisões técnicas e os próximos passos.

**Resultado:** as 8 etapas do plano inicial estão concluídas. O site já mostra produtos cadastrados no painel, e as páginas de vendas são montadas por um editor visual em blocos, com pré-visualização ao vivo.

---

## Onde estamos no plano

| # | Etapa | Situação |
|---|---|---|
| 1 | Analisar a estrutura atual | ✅ |
| 2 | Definir arquitetura (frontend, backend, banco) | ✅ |
| 3 | Ambiente local com Docker Compose | ✅ |
| 4 | Painel administrativo com autenticação | ✅ |
| 5 | Cadastro, edição e exclusão de produtos | ✅ |
| 6 | Upload e gerenciamento de imagens | ✅ |
| 7 | Página de vendas como modelo reutilizável | ✅ (com editor visual em React) |
| 8 | Páginas públicas a partir dos dados cadastrados | ✅ |

---

## O que foi feito

### Etapa 4 — Login do painel
- Login por sessão (cookie `HttpOnly` + `SameSite=Strict`), senha com scrypt, proteção CSRF e limite de tentativas.
- Admins criados pelo terminal (`scripts/admin-user.js`) — sem cadastro público, por segurança.

### Etapa 5 — Produtos
- `courses` renomeado para `products` (o catálogo tem cursos e materiais digitais).
- Novos campos: categoria, destaque, descrição, público, pré-requisitos, módulos, formato, carga horária, preço (em centavos) e link de checkout (só `https://`).
- Painel: lista com busca, situação editável na própria lista, formulário completo, exclusão só de rascunhos/arquivados (publicado precisa ser arquivado antes).
- Painel responsivo, modo noturno, proteção contra sair com alterações não salvas.

### Etapa 6 — Imagens
- Upload sem dependência de multipart; tipo conferido pela assinatura do arquivo (PNG, JPEG, WebP; SVG recusado).
- **sharp** converte para WebP, reduz para até 1600 px e remove metadados (inclusive GPS). A capa do Manual caiu de 1,5 MB para 101 KB.
- Biblioteca de imagens: envio múltiplo, texto alternativo, onde cada imagem é usada, filtro "sem uso", visualizador.
- Imagem em uso não pode ser excluída (o próprio banco recusa).

### Etapa 7 — Páginas de vendas em blocos
- 12 tipos de bloco (abertura, benefícios, tópicos, galeria, lista ✓/✗, comparativo, autor, público-alvo, destaque, FAQ, garantia, oferta final), definidos num esquema único (`server/sales/blocks.js`) que serve para validar, gerar o formulário do editor e o modelo padrão.
- Página renderizada **no servidor** em `/p/nome-do-produto`: prévias de link (WhatsApp/redes) funcionam e o HTML chega pronto.
- Templates com escape automático (proteção contra XSS) e CSP restrita.
- A página estática do Manual foi importada para o banco (`scripts/import-manual.js`) e ficou visualmente igual.
- **Editor visual em React**:
  - pré-visualização ao vivo lado a lado (computador/celular), renderizada pelo servidor;
  - clicar numa seção abre o bloco; passar o mouse destaca nos dois sentidos;
  - arrastar e soltar (mouse, toque e teclado), desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z);
  - seletor visual de tipo de bloco, inserção entre blocos, ícones visuais, aviso "não aparece";
  - **cores da página**: 6 paletas ou personalizada, com contraste garantido pelo servidor;
  - **versões**: "Salvar rascunho" nunca muda o site; "Publicar alterações" leva ao ar.

### Etapa 8 — Site público lendo do banco
- Home (destaques) e catálogo (busca + categorias) carregam os produtos da API.
- Cartão com página de vendas publicada leva para `/p/…`; os demais, para `/produto.html`.

### Faxina e organização
- Removidos: protótipo de página de vendas, página estática do Manual, colunas e CSS sem uso.
- Redirecionamentos permanentes (301): `/curso-reforma-tributaria.html` → `/p/manual-reforma-tributaria` e `/curso.html` → `/produto.html`.
- `data/cursos.js` → `data/site.js` (só configuração do site).
- Paleta nova (azul-marinho e dourado), modo escuro em cinza neutro — todos os pares de cor dentro do WCAG AA.

---

## Decisões técnicas importantes

| Decisão | Motivo |
|---|---|
| Página de vendas renderizada no servidor | Prévias de link e SEO; HTML pronto sem "Carregando…" |
| Catálogo/home renderizados no navegador (via API) | O código já estava pronto para dados assíncronos; as páginas que importam para SEO (vendas) já são do servidor |
| React só no editor (ilha), resto em JS puro | Editor visual complexo justifica o framework; o resto não precisa |
| Vite com build multi-stage no Docker | A imagem de produção não leva Vite/React, só o arquivo gerado |
| Preço em centavos (inteiro) | Evita erros de arredondamento de números decimais |
| Esquema único de blocos no servidor | Validação, editor e modelo padrão sempre em sincronia |
| Cores da página via CSS gerado (`/page-theme.css`) | Mantém a CSP restrita (sem CSS embutido no HTML) |
| Rascunho × versão publicada | Editar uma página no ar não muda o site até publicar |
| Situação do produto = único controle de "aparece no site" | Evita dois interruptores para a mesma pergunta |

---

## Como usar no dia a dia

```bash
docker compose up --build -d          # sobe banco, migrations, API e o compilador do editor
docker compose run --rm migrate       # aplica migrations novas
docker compose restart app            # se a API não recarregar sozinha após editar server/
docker compose restart editor         # se o editor React não recompilar sozinho
docker compose exec app npm run admin:user   # criar admin / redefinir senha
```

| Endereço | O quê |
|---|---|
| `http://127.0.0.1:3000/` | Site (home) |
| `http://127.0.0.1:3000/catalogo.html` | Catálogo |
| `http://127.0.0.1:3000/p/<endereco>` | Página de vendas publicada |
| `http://127.0.0.1:3000/admin/` | Painel |

---

## Observação sobre o dia

Os testes automáticos do editor usavam a página real do Manual como cenário e, depois que o Manual foi publicado, sobrescreveram o **rascunho** dele (a versão publicada não foi afetada). O rascunho foi restaurado a partir da versão publicada; edições não publicadas que existissem naquele momento se perderam. Os testes agora criam e apagam um produto temporário próprio.

---

## Próximos passos

### 1. Levar os testes automáticos para o repositório (prioridade alta)
Hoje os testes de interface (jsdom) e de API rodaram de uma pasta temporária, fora do projeto. Colocá-los em `server/test/` (ou `tests/`) com um comando `npm test` permite rodá-los a cada mudança e evita regressões — e é um ótimo ponto de portfólio. Eles devem sempre usar dados próprios (como já ajustado).

### 2. README
Instalação, `.env`, comandos do Docker, criação do admin, estrutura de pastas e como publicar uma página. (Observação: `scripts/gerar-env.js` precisa de Node no computador; documentar a alternativa via Docker.)

### 3. Preparação para produção
- `PUBLIC_URL` (prévias de link com o endereço real) e HTTPS com `COOKIE_SECURE=true`.
- `trust proxy` no Express, se houver proxy/CDN na frente (o limite de tentativas de login depende do IP real).
- Compressão das respostas (o editor tem ~92 KB compactado; o Express hoje não comprime).
- **Backup do banco e do volume `uploads`** (as imagens ficam fora do banco).
- Escolha da hospedagem (com disco persistente, ou trocar `lib/storage.js` por S3/R2).

### 4. Configuração do site pelo painel
Nome da marca, slogan, contato e dados do professor ainda são editados em `public/data/site.js`. Uma tela "Configurações" no painel resolveria.

### 5. Melhorias de produto (quando fizer sentido)
- "Alterar minha senha" dentro do painel.
- Duplicar página de vendas de um produto para outro.
- Histórico de versões publicadas (voltar para uma publicação anterior).

### 6. Integração com a Kiwify (fase futura, conforme planejado)
Sincronizar produtos, preços, ofertas e links de checkout. A tabela `product_integrations` já existe para isso; credenciais ficam só no servidor (`.env`).

---

## Commits do dia (21)

```
c597f41 refactor(web): move static frontend to public/
291d3a1 build(docker): run migrations automatically and add dev override
d3ed820 docs: rewrite README for the platform setup
70fe889 chore(deps): add package-lock.json
54ba2af feat(admin): add session-based login for the admin panel
6529d45 feat(products): rename courses to products and add catalog fields
b6b2040 feat(admin): add product form, list actions and theme toggle
e2fc66b feat(admin): status controls, product search and responsive panel
16e6b68 style(theme): navy and gold palette for light and dark modes
e15592a feat(media): image upload API with sharp processing
9610b6f feat(admin): cover image picker, image library and image viewer
8064533 feat(sales): server-rendered sales pages built from typed blocks
f853218 feat(admin): sales page block editor (vanilla JS)
8d59543 build(editor): React + Vite toolchain for the sales page editor
f6213d2 feat(editor): React sales page editor with live preview
a2795c0 style(editor): app-like layout, visual block cards and block picker
aa107e3 feat(editor): undo/redo, drag and drop, visual icons and compact items
29d2bbf feat(theme): gray dark mode, sharper light mode and sales page colors
1d8dbf3 fix(editor): live preview never navigates away
4d73390 feat(sales): draft and published versions of sales pages
1b583bc feat(site): catalog and home read products from the database; cleanup
```
