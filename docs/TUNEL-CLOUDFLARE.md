# Mostrar o site local para outra pessoa (túnel Cloudflare)

Gera um link público e temporário (`https://...trycloudflare.com`) que aponta para o site
rodando no seu computador. Funciona de qualquer rede: celular no 4G, outra casa, etc.
Não precisa de conta na Cloudflare, de mexer no roteador nem de liberar porta no firewall.

> Use só para testes e demonstrações. Quem tiver o link acessa o site inteiro, inclusive a
> tela de login do painel. Feche o túnel quando terminar.

## Abrir

1. Abra o Docker Desktop e suba o site (na pasta do projeto):

   ```powershell
   docker compose up --build
   ```

   Confirme que `http://localhost:3000` abre no seu navegador.

2. Em **outro** terminal, abra o túnel:

   ```powershell
   npx cloudflared tunnel --url http://localhost:3000
   ```

   Na primeira vez o `npx` pergunta se pode instalar o `cloudflared`: responda `y`.

3. Procure no terminal um quadro parecido com este:

   ```
   +--------------------------------------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
   |  https://palavras-aleatorias-exemplo.trycloudflare.com                                     |
   +--------------------------------------------------------------------------------------------+
   ```

4. Envie esse link para quem vai ver o site. Pode levar alguns segundos até ele começar a
   responder.

Deixe esse terminal aberto: o link só funciona enquanto o comando estiver rodando.

## Fechar

1. No terminal do túnel, aperte **Ctrl + C**. O link para de funcionar na hora.
2. Se também quiser desligar o site:

   ```powershell
   docker compose down
   ```

   Os dados (banco e imagens enviadas) ficam guardados e voltam no próximo `docker compose up`.

## Bom saber

- **O link muda a cada vez** que você abre o túnel. Mande o novo link sempre que reabrir.
- **Seu computador precisa ficar ligado** e com o site rodando enquanto a outra pessoa usa.
- **Não precisa mudar a porta** no `docker-compose.yml`: o túnel acessa o `localhost`, então a
  linha `127.0.0.1:3000:3000` pode continuar como está.
- **Painel pelo link:** para mostrar o site, o túnel basta. Para editar conteúdo, prefira
  usar o painel direto no seu computador (`http://localhost:3000`): pelo link público o
  painel pode recusar alterações, porque ele confere se o pedido veio do mesmo endereço do site.
- **O link parou de abrir?** Veja se o terminal do túnel ainda está rodando e se
  `http://localhost:3000` abre no seu computador. Se não abrir, o problema está no Docker,
  não no túnel.
