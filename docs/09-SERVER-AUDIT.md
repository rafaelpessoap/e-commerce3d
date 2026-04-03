# 09 — Auditoria do Servidor e Plano de Deploy

> Auditoria realizada em 2 de abril de 2026 no servidor 24.152.39.104

---

## Estado Atual do Servidor

### Hardware e Discos

| Disco | Tipo | Tamanho | Montado em | Uso | Notas |
|-------|------|---------|-----------|-----|-------|
| `/dev/sda` | SSD/HDD | 231 GB | `/` (LVM) | 49 GB (23%) | Sistema operacional, apps do sistema |
| `/dev/nvme0n1` | **NVMe** | 1.8 TB | `/nvme` e `/home` | 170 GB (10%) | **Docker já está aqui** |

**Docker Root Dir: `/nvme/docker`** — Perfeito, já está no NVMe.

### OS
- Ubuntu 24.04.4 LTS (Noble Numbat)

### Serviços rodando

| Serviço | Tipo | Porta | Versão | Status |
|---------|------|-------|--------|--------|
| OpenLiteSpeed | Local | 80, 443, 7080 (admin) | 1.8.4 | Ativo — front-end de TUDO |
| MariaDB | Local | 3306 (127.0.0.1) | — | Ativo — usado pelo WordPress (Arsenal Craft) |
| Redis | Local | 6379 (127.0.0.1) | 7.0.15 | Ativo |
| Elasticsearch | Local | 9200, 9300 (127.0.0.1) | 9.3.2 | Ativo |
| Postfix (SMTP) | Local | 25, 465, 587 | — | Ativo — email |
| PowerDNS | Local | 53 | — | Ativo — DNS |
| SSH | Local | 2222 | — | Ativo |
| nghttpx | Local | 3000 (127.0.0.1) | — | Ativo (HTTP/2 proxy?) |
| Docker: arsenal_app | Container | 127.0.0.1:3001 | ghcr.io/rafaelpessoap/arsenal-erp:latest | Ativo |
| Docker: arsenal_db | Container | Interno (5432) | postgres:18-alpine | Ativo (healthy) |
| Docker: n8n | Container | 127.0.0.1:5678 | n8n 2.15.0 | Ativo |
| Netdata | Local | 10.8.0.1:19999 | — | Ativo (monitoramento via VPN) |

### Containers Docker existentes

```
arsenal_app   → ghcr.io/rafaelpessoap/arsenal-erp:latest   (porta 127.0.0.1:3001)
arsenal_db    → postgres:18-alpine                          (porta interna 5432)
n8n           → docker.n8n.io/n8nio/n8n:2.15.0              (porta 127.0.0.1:5678)
```

### Redes Docker

```
bridge       — padrão
erp_default  — usada pelo arsenal_app e arsenal_db
erp_erp_net  — usada pelo n8n para acessar a rede do ERP
host         — host
none         — none
```

### Projetos Docker existentes

**Arsenal ERP** (`/opt/erp/docker-compose.prod.yml`):
- app (Next.js) + db (PostgreSQL 18)
- Porta 3001 (127.0.0.1 only)
- Imagem via GHCR (GitHub Container Registry)
- Volume: `uploads_data` para uploads
- Rede: `erp_default`

**N8N** (`/nvme/n8n/docker-compose.yml`):
- n8n na porta 5678 (127.0.0.1 only)
- Volume: `/nvme/n8n/data` e `/nvme/n8n/files`
- Conecta na rede `erp_default` para acessar o postgres do ERP

---

## Como o OLS faz proxy reverso (padrão a seguir)

O `erp.arsenalcraft.com.br` é o modelo perfeito. O OLS recebe a request e faz proxy para o container Docker:

```
Internet → Cloudflare → OLS (:80/:443) → proxy → 127.0.0.1:3001 (Docker)
```

Configuração do vhost OLS:
```apache
# extprocessor define o backend
extprocessor nextjs {
  type                    proxy
  address                 127.0.0.1:3001
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

# context / faz o proxy de tudo
context / {
  type                    proxy
  handler                 nextjs
  addDefaultCharset       off
}
```

---

## DNS do elitepinup3d.com.br

O DNS está apontando para **Cloudflare** (IPs 172.67.162.115 e 104.21.66.174), não direto para o servidor. Isso é bom — significa que Cloudflare está na frente como proxy/CDN.

O IP real do servidor é `24.152.39.104`. O Cloudflare está configurado para fazer proxy para esse IP.

---

## Portas disponíveis para o novo projeto

| Porta | Status | Uso |
|-------|--------|-----|
| 3000 | **OCUPADA** | nghttpx |
| 3001 | **OCUPADA** | arsenal_app |
| 3002 | **LIVRE** | ← Backend NestJS (elitepinup3d) |
| 3003 | **LIVRE** | ← Frontend Next.js (elitepinup3d) |
| 5432 | OCUPADA (interna) | arsenal_db (PostgreSQL) |
| 5678 | OCUPADA | n8n |
| 6379 | OCUPADA | Redis local |
| 9200 | OCUPADA | Elasticsearch local |

---

## Plano de Deploy — ElitePinup3D

### Mudanças necessárias no projeto

**IMPORTANTE: O projeto precisa de ajustes no `04-DOCKER-SPECS.md` e no compose de produção:**

1. **NÃO usar Nginx no Docker.** O OLS já é o reverse proxy. Nginx seria redundante e conflitaria. Remover o serviço nginx do compose de produção.

2. **Portas:** Backend na `3002`, Frontend na `3003` (ambas `127.0.0.1` only).

3. **PostgreSQL:** Não precisa de container próprio. Usar o PostgreSQL do container `arsenal_db` existente, apenas criar um database novo. OU criar um container PostgreSQL separado na mesma rede sem expor porta.

4. **Redis e Elasticsearch:** Acessar os serviços locais do host. No Docker, usar `host.docker.internal` ou a flag `network_mode: host`, ou mapear via `extra_hosts`.

### Arquitetura de produção (corrigida)

```
Internet → Cloudflare → OLS (:443) → proxy → 127.0.0.1:3003 (Next.js container)
                                            ↘ 127.0.0.1:3002 (NestJS container)

Containers:
  elitepinup-backend  → NestJS  → 127.0.0.1:3002
  elitepinup-frontend → Next.js → 127.0.0.1:3003
  elitepinup-db       → PostgreSQL 18 (porta interna, sem expor) [OPCIONAL — pode usar o arsenal_db]

Serviços do host (acessados via extra_hosts ou bridge):
  Redis        → 127.0.0.1:6379
  Elasticsearch → 127.0.0.1:9200
  SMTP         → 127.0.0.1:25
```

### Estrutura de diretórios no servidor

```
/opt/elitepinup/
├── docker-compose.prod.yml
├── .env                        # Variáveis de ambiente de produção
└── (imagens vêm do GHCR, sem código no servidor)
```

### docker-compose.prod.yml (corrigido para este servidor)

```yaml
services:
  db:
    image: postgres:18-alpine
    container_name: elitepinup_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-elitepinup}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-elitepinup}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-elitepinup} -d ${DB_NAME:-elitepinup}"]
      interval: 10s
      timeout: 5s
      retries: 5
    # SEM ports expostas — só acessível pelos outros containers na rede

  backend:
    image: ghcr.io/rafaelpessoap/e-commerce3d-backend:latest
    container_name: elitepinup_backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3002
      DATABASE_URL: "postgresql://${DB_USER:-elitepinup}:${DB_PASSWORD}@db:5432/${DB_NAME:-elitepinup}"
      REDIS_URL: "redis://host.docker.internal:6379"
      ELASTICSEARCH_NODE: "http://host.docker.internal:9200"
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      MERCADOPAGO_ACCESS_TOKEN: ${MERCADOPAGO_ACCESS_TOKEN}
      MERCADOPAGO_WEBHOOK_SECRET: ${MERCADOPAGO_WEBHOOK_SECRET}
      MELHORENVIO_TOKEN: ${MELHORENVIO_TOKEN}
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME}
      R2_PUBLIC_URL: ${R2_PUBLIC_URL}
      SMTP_HOST: host.docker.internal
      SMTP_PORT: 587
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SMTP_FROM: ${SMTP_FROM}
      FRONTEND_URL: "https://elitepinup3d.com.br"
    ports:
      - "127.0.0.1:3002:3002"
    extra_hosts:
      - "host.docker.internal:host-gateway"

  frontend:
    image: ghcr.io/rafaelpessoap/e-commerce3d-frontend:latest
    container_name: elitepinup_frontend
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: "https://elitepinup3d.com.br/api"
      INTERNAL_API_URL: "http://backend:3002"
    ports:
      - "127.0.0.1:3003:3000"

volumes:
  postgres_data:
```

### Configuração do vhost OLS para elitepinup3d.com.br

Criar o vhost seguindo o padrão do `erp.arsenalcraft.com.br`:

```apache
docRoot                   $VH_ROOT/public_html
vhDomain                  elitepinup3d.com.br
vhAliases                 www.elitepinup3d.com.br
adminEmails               rafaelzezao@gmail.com
enableGzip                1
enableIpGeo               1

errorlog $VH_ROOT/logs/elitepinup3d.com.br.error_log {
  useServer               0
  logLevel                WARN
  rollingSize             10M
}

accesslog $VH_ROOT/logs/elitepinup3d.com.br.access_log {
  useServer               0
  logFormat               "%h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-Agent}i\""
  logHeaders              5
  rollingSize             10M
  keepDays                10
  compressArchive         1
}

# Backend API (NestJS)
extprocessor api {
  type                    proxy
  address                 127.0.0.1:3002
  maxConns                200
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

# Frontend (Next.js)
extprocessor frontend {
  type                    proxy
  address                 127.0.0.1:3003
  maxConns                200
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

# API routes → backend
context /api/ {
  type                    proxy
  handler                 api
  addDefaultCharset       off
}

# Webhook do Mercado Pago → backend
context /payments/webhook {
  type                    proxy
  handler                 api
  addDefaultCharset       off
}

# Tudo o resto → frontend (Next.js)
context / {
  type                    proxy
  handler                 frontend
  addDefaultCharset       off
}

# Next.js assets
context /_next/ {
  type                    proxy
  handler                 frontend
  addDefaultCharset       off
}

# Sitemap e robots
context /sitemap.xml {
  type                    proxy
  handler                 api
  addDefaultCharset       off
}

context /robots.txt {
  type                    proxy
  handler                 api
  addDefaultCharset       off
}

module cache {
  storagePath /usr/local/lsws/cachedata/elitepinup3d.com.br
}

rewrite {
  enable                  1
  autoLoadHtaccess        1
}

# ACME challenge para Let's Encrypt
context /.well-known/acme-challenge {
  location                /usr/local/lsws/Example/html/.well-known/acme-challenge
  allowBrowse             1
  rewrite {
    enable                0
  }
  addDefaultCharset       off
}

# SSL (gerar com certbot depois)
vhssl {
  keyFile                 /etc/letsencrypt/live/elitepinup3d.com.br/privkey.pem
  certFile                /etc/letsencrypt/live/elitepinup3d.com.br/fullchain.pem
  certChain               1
  sslProtocol             24
  enableECDHE             1
  renegProtection         1
  sslSessionCache         1
  enableSpdy              15
  enableStapling          1
  ocspRespMaxAge          86400
}
```

### GitHub Actions deploy.yml (corrigido para este servidor)

O deploy segue o mesmo padrão do arsenal-erp:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [ci]  # Só deploya se CI passou

    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          file: ./docker/backend.Dockerfile
          push: true
          tags: ghcr.io/rafaelpessoap/e-commerce3d-backend:latest

      - name: Build and push frontend
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          file: ./docker/frontend.Dockerfile
          push: true
          tags: ghcr.io/rafaelpessoap/e-commerce3d-frontend:latest

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: 24.152.39.104
          username: masterdaweb
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: 2222
          script: |
            cd /opt/elitepinup
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            # Health check
            sleep 10
            curl -sf http://127.0.0.1:3002/api/v1/health || (docker compose -f docker-compose.prod.yml logs --tail=50 && exit 1)
            curl -sf http://127.0.0.1:3003 || (docker compose -f docker-compose.prod.yml logs --tail=50 && exit 1)
            echo "Deploy OK!"
```

### Secrets necessários no GitHub

```
SSH_PRIVATE_KEY          → Chave SSH para o servidor
DB_PASSWORD              → Senha do PostgreSQL
JWT_SECRET               → Secret do JWT (64+ chars aleatórios)
JWT_REFRESH_SECRET       → Secret do refresh token (64+ chars)
MERCADOPAGO_ACCESS_TOKEN → Token do Mercado Pago
MERCADOPAGO_WEBHOOK_SECRET → Secret do webhook MP
MELHORENVIO_TOKEN        → Token do Melhor Envio
R2_ACCOUNT_ID            → Cloudflare R2
R2_ACCESS_KEY_ID         → Cloudflare R2
R2_SECRET_ACCESS_KEY     → Cloudflare R2
R2_BUCKET_NAME           → Cloudflare R2
R2_PUBLIC_URL            → URL pública do R2
SMTP_USER                → Usuário SMTP
SMTP_PASS                → Senha SMTP
SMTP_FROM                → Email remetente
```

---

## O que você precisa arrumar no projeto antes do deploy

### 1. Remover Nginx do compose de produção
O OLS é o reverse proxy. Nginx dentro do Docker seria redundante. O `04-DOCKER-SPECS.md` e o compose de prod devem ser atualizados.

### 2. Ajustar portas
- Backend: `127.0.0.1:3002:3002`
- Frontend: `127.0.0.1:3003:3000`
Nunca `0.0.0.0` — só localhost, o OLS faz o proxy.

### 3. Redis e Elasticsearch via host
No compose de produção, usar `extra_hosts: ["host.docker.internal:host-gateway"]` para os containers acessarem os serviços locais.

### 4. Gerar SSL com certbot
Depois de criar o vhost no OLS:
```bash
sudo certbot certonly --webroot -w /usr/local/lsws/Example/html -d elitepinup3d.com.br -d www.elitepinup3d.com.br
```
Nota: como o DNS passa pelo Cloudflare, pode ser necessário usar DNS challenge ou pausar o proxy do Cloudflare temporariamente.

### 5. Criar vhost no OLS
Via painel admin (porta 7080) ou editando os arquivos diretamente.

### 6. Adicionar ao listener no httpd_config.conf
```apache
listener Default {
  map  elitepinup3d.com.br elitepinup3d.com.br
  ...
}
listener SSL {
  map  elitepinup3d.com.br elitepinup3d.com.br
  ...
}
```

---

## Checklist de setup no servidor (quando o projeto estiver pronto)

```
1. [ ] Criar diretório: sudo mkdir -p /opt/elitepinup
2. [ ] Criar .env com todas as variáveis
3. [ ] Copiar docker-compose.prod.yml para /opt/elitepinup/
4. [ ] Criar vhost no OLS para elitepinup3d.com.br
5. [ ] Adicionar maps nos listeners (Default, SSL, IPv6 SSL)
6. [ ] Reiniciar OLS: sudo /usr/local/lsws/bin/lswsctrl restart
7. [ ] Gerar certificado SSL com certbot
8. [ ] Configurar SSL no vhost OLS
9. [ ] Reiniciar OLS novamente
10. [ ] Pull das imagens e subir containers
11. [ ] Testar acesso via https://elitepinup3d.com.br
12. [ ] Configurar GitHub Actions secrets
13. [ ] Testar deploy automático (push para main)
```
