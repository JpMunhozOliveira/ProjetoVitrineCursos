# Colocar o site no ar

Guia para publicar a Vitrine de Cursos num servidor próprio (VPS) com Docker e HTTPS. Siga na ordem; cada etapa diz como conferir se deu certo antes de passar para a próxima.

**Como fica no servidor:** o Caddy recebe os visitantes nas portas 80/443, cuida do certificado HTTPS (Let's Encrypt, renovação automática) e repassa ao app. O app e o banco não ficam expostos na internet.

```
visitante ──https──▶ Caddy (80/443) ──▶ app (Node, 127.0.0.1:3000) ──▶ Postgres (rede interna)
                                          └─ imagens enviadas: volume "uploads"
```

**Custo aproximado** (confira os preços na hora de contratar): VPS de R$ 30 a R$ 60/mês e domínio `.com.br` por cerca de R$ 40/ano.

---

## 1. Registrar o domínio

1. Em [registro.br](https://registro.br), crie a conta (pede CPF) e registre o domínio, por exemplo `seusite.com.br`.
2. Mantenha o DNS no próprio Registro.br. Ele será configurado na etapa 4, depois que você tiver o IP do servidor.

## 2. Contratar o servidor (VPS)

**Recomendado:** Hostinger, plano VPS KVM 1 ou KVM 2. Tem datacenter no Brasil (o site fica mais rápido para quem está aqui), aceita Pix e tem suporte em português. Alternativas equivalentes: Vultr ou AWS Lightsail (região São Paulo).

Na contratação:
- **Sistema:** Ubuntu 24.04 LTS, a versão "pura" (sem painel de controle).
- **Memória:** pelo menos 2 GB. Com 4 GB fica folgado.
- **Localização:** Brasil (São Paulo), se houver.
- **Chave SSH:** gere no seu Windows (PowerShell) e cole o conteúdo do arquivo `.pub` no painel do provedor:
  ```powershell
  ssh-keygen -t ed25519 -C "vitrine"
  Get-Content $HOME\.ssh\id_ed25519.pub
  ```
- **Firewall do painel** (se o provedor tiver): libere as portas 22, 80 e 443.

Anote o **IP** do servidor. Para testar o acesso: `ssh root@IP_DO_SERVIDOR`.

## 3. Preparar o servidor (uma vez só)

Faça tudo conectado como `root` (`ssh root@IP_DO_SERVIDOR`).

**3.1. Atualizar o sistema e ativar as atualizações automáticas de segurança**
```bash
apt update && apt upgrade -y
apt install -y unattended-upgrades git
dpkg-reconfigure -f noninteractive unattended-upgrades
```

**3.2. Criar o usuário `deploy`** (você não vai mais usar o root no dia a dia)
```bash
adduser deploy                       # defina uma senha (usada no sudo)
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```
⚠️ **Antes de continuar**, abra OUTRO terminal e confirme que `ssh deploy@IP_DO_SERVIDOR` funciona. Se não funcionar, não siga para o 3.3, ou você fica sem acesso.

**3.3. Bloquear o login por senha e o login como root**
```bash
printf 'PasswordAuthentication no\nPermitRootLogin no\n' > /etc/ssh/sshd_config.d/99-vitrine.conf
systemctl restart ssh
```

**3.4. Firewall**
```bash
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw --force enable
```

**3.5. Swap de 2 GB** (o build do editor usa bastante memória; evita travar em servidores pequenos)
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**3.6. Instalar o Docker** (repositório oficial, conforme docs.docker.com)
```bash
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deploy
```

**3.7. Pasta do site**
```bash
mkdir -p /srv/vitrine && chown deploy:deploy /srv/vitrine
```

✅ **Conferir:** saia (`exit`), entre como `ssh deploy@IP_DO_SERVIDOR` e rode `docker compose version`. Deve mostrar a versão, sem erro de permissão.

> Daqui em diante, use sempre o usuário **deploy**.

## 4. Apontar o domínio para o servidor

No Registro.br, abra o domínio, depois **DNS → Editar zona** e crie:

| Tipo | Nome | Valor |
|------|------|-------|
| A | *(vazio, ou @)* | IP_DO_SERVIDOR |
| A | www | IP_DO_SERVIDOR |

✅ **Conferir** (pode levar de minutos a algumas horas): no seu PC, `nslookup seusite.com.br` deve responder com o IP do servidor. **Só siga para a etapa 7 depois disso**: sem o DNS certo, o certificado HTTPS não é emitido.

## 5. Baixar o código

```bash
cd /srv/vitrine
git clone https://github.com/JpMunhozOliveira/ProjetoVitrineCursos.git .
```
(Se o repositório virar privado, cadastre no GitHub uma *deploy key* somente leitura com uma chave SSH gerada no servidor e use o endereço `git@github.com:...`.)

## 6. Configurar o `.env`

**6.1. Gerar o arquivo com senhas do banco e chave de API aleatórias** (o Node roda dentro de um container, então não precisa instalá-lo no servidor):
```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:22-alpine node scripts/gerar-env.js
```

**6.2. Editar o arquivo:** `nano .env` (salvar: Ctrl+O, Enter; sair: Ctrl+X)
- **Descomente** (tire o `#` do começo) as duas linhas:
  ```
  COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
  COMPOSE_PATH_SEPARATOR=:
  ```
- **Preencha:**
  ```
  DOMAIN=seusite.com.br
  ACME_EMAIL=seu@email.com
  ```
- `PUBLIC_URL`, `TRUST_PROXY` e `COOKIE_SECURE` podem ficar como estão: com o `docker-compose.prod.yml`, eles são definidos automaticamente a partir do `DOMAIN`.

**6.3. Proteger o arquivo:** `chmod 600 .env`

**6.4. Guardar as senhas do banco (`POSTGRES_PASSWORD` e `APP_DB_PASSWORD`) e a `ADMIN_API_KEY`** num gerenciador de senhas. O app conecta ao banco com o usuário `APP_DB_USER`, que só lê e grava dados; o `POSTGRES_USER` (dono do banco) fica para as migrations e os backups. Sem elas, os backups continuam restauráveis, mas você perde o acesso de automação.

## 7. Subir o site

```bash
docker compose up -d --build
```
A primeira vez leva alguns minutos (o build compila o editor). Depois:
```bash
docker compose ps             # db, app e caddy "Up", com db e app "(healthy)"
docker compose logs caddy     # procure "certificate obtained successfully"
```

✅ **Conferir:** abra `https://seusite.com.br/api/health`. Deve aparecer `{"status":"ok","database":"connected"}` com o cadeado do HTTPS.

## 8. Criar o administrador do painel

```bash
docker compose run --rm app node scripts/admin-user.js seu@email.com
```
O script pede a senha (mínimo 12 caracteres). Para trocar a senha depois, rode o mesmo comando: as sessões abertas são encerradas.

## 9. Testar tudo

- [ ] `http://seusite.com.br` redireciona para `https://`.
- [ ] `https://www.seusite.com.br` redireciona para `https://seusite.com.br`.
- [ ] Login em `https://seusite.com.br/admin/login.html`.
- [ ] Enviar uma imagem, editar um produto e publicar a página de vendas.
- [ ] Abrir `/p/endereco-do-produto` numa aba anônima.
- [ ] Colar o link da página no WhatsApp: a prévia aparece com imagem e título.
- [ ] O botão de compra leva ao checkout da Kiwify.

## 10. Backup automático

**10.1. Primeiro backup, feito à mão** (cria a pasta `backups/`):
```bash
sh /srv/vitrine/scripts/backup.sh
ls -lh /srv/vitrine/backups
```

**10.2. Agendar todo dia às 3h:** `crontab -e` e acrescente:
```
0 3 * * * sh /srv/vitrine/scripts/backup.sh >> /srv/vitrine/backups/backup.log 2>&1
```
Os backups com mais de 14 dias são apagados sozinhos.

**10.3. Ter uma cópia FORA do servidor.** Se o servidor for perdido, os backups dentro dele vão junto. Escolha ao menos uma opção:
- ative os **snapshots/backups automáticos** do provedor (a Hostinger oferece no painel);
- de tempos em tempos, baixe para o seu PC (PowerShell):
  ```powershell
  scp deploy@IP_DO_SERVIDOR:/srv/vitrine/backups/*.dump deploy@IP_DO_SERVIDOR:/srv/vitrine/backups/*.tar.gz .
  ```

**10.4. Restaurar** (substitui os dados atuais e pede confirmação):
```bash
cd /srv/vitrine
sh scripts/restore.sh backups/db-AAAA-MM-DD_HHMM.dump backups/uploads-AAAA-MM-DD_HHMM.tar.gz
```
Faça um teste de restauração uma vez, logo depois de colocar o site no ar. Backup que nunca foi restaurado não é garantia.

## 11. Atualizar o site depois de mudanças no código

No seu PC, faça commit e `git push`. No servidor:
```bash
cd /srv/vitrine
git pull
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:22-alpine node scripts/gerar-env.js   # acrescenta ao .env variáveis novas (não mexe nas existentes)
docker compose up -d --build     # as migrations do banco rodam sozinhas antes do app subir
docker image prune -f            # apaga imagens antigas (economiza disco)
```
Se algo der errado, volte para a versão anterior com `git log --oneline` e `git checkout <commit>`, depois rode `docker compose up -d --build` de novo. Atenção: se a versão nova trouxe migration, restaure também o backup do banco.

## 12. Antes de divulgar

- Confira no painel os **links de checkout da Kiwify** de cada produto.
- Revise `public/data/site.js` (nome, slogan, contato e redes sociais), faça commit e atualize (etapa 11).
- Opcional: cadastre o site no [Google Search Console](https://search.google.com/search-console) para acompanhar como ele aparece nas buscas.
- Recomendado: cadastre um **monitor de disponibilidade** gratuito (ex.: UptimeRobot) apontando para
  `https://SEU-DOMINIO/api/health`. Ele avisa por e-mail se o site sair do ar.

## 13. Desempenho

- **Teste de carga:** `node scripts/teste-carga.js https://SEU-DOMINIO 20 10` (20 visitantes ao mesmo
  tempo por 10 s em cada página principal). Mostra pedidos por segundo, tempo médio, p95/p99 e erros.
  Rode fora do horário de vendas e compare com rodadas anteriores depois de mudanças grandes.
  Referência no computador de desenvolvimento (Docker local, 20 conexões): páginas do site
  ~4.000 pedidos/s, API do catálogo ~2.000/s, página de vendas ~650/s, todas sem erros e com p99
  abaixo de 60 ms.
- **Consultas lentas:** o banco registra toda consulta acima de 500 ms. Para ver:
  `docker compose logs db | grep duration`. Vazio = nenhuma consulta lenta.
- **Uso de CPU, memória e disco:** `docker stats --no-stream` e `df -h`.
- **Cache no navegador:** CSS e JS saem com a versão na URL (`site.css?v=…`) e ficam guardados no
  navegador por 1 ano. Ao atualizar o site (etapa 11), as páginas passam a apontar para a versão nova
  sozinhas, sem precisar limpar o cache.
- **Imagens:** cada imagem enviada ganha versões de 480 e 960 px, e o navegador baixa a que serve
  para a tela. As imagens enviadas antes disso são convertidas sozinhas quando o app inicia (veja
  `docker compose logs app`).

---

## Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| O site não abre e o log do Caddy fala em "challenge failed" | DNS ainda não aponta para o servidor (etapa 4) ou portas 80/443 bloqueadas no firewall do painel do provedor. Corrija e rode `docker compose restart caddy`. |
| `docker compose` reclama de `DOMAIN` ou `ACME_EMAIL` | Faltou preencher no `.env` (etapa 6.2). |
| `docker compose` reclama de `APP_DB_USER` ou `APP_DB_PASSWORD` | `.env` criado antes dessas variáveis existirem. Rode o `gerar-env.js` (comando da etapa 11): ele só acrescenta o que falta. |
| Login dá "Muitas tentativas" para todo mundo | `TRUST_PROXY` errado. Com o Cloudflare em modo proxy (nuvem laranja) na frente, são 2 proxies: acrescente `TRUST_PROXY: "2"` no `docker-compose.prod.yml`. |
| O build trava ou o servidor fica lento | Pouca memória: confira a swap (`free -h`) ou aumente o plano. |
| Ver os erros do app | `docker compose logs app --tail 100` |

**Nunca apague o volume `caddy_data`** (ele guarda os certificados; o Let's Encrypt limita quantas vezes um domínio pode pedir certificado novo por semana). Também nunca apague os volumes `postgres_data` e `uploads` (os dados do site). Ou seja: **não use** `docker compose down -v`.
