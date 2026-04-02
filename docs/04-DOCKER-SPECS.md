# Docker Specifications - 3D Miniatures E-commerce

Especificações completas de containerização para o projeto de e-commerce de miniaturas 3D, com suporte a três ambientes: desenvolvimento, testes e produção.

## Visão Geral da Arquitetura

```
┌─────────────┐
│   Nginx     │ (Reverse Proxy / Load Balancer)
└─────┬───────┘
      │
      ├─────────────────┬──────────────────┐
      │                 │                  │
  ┌───▼──────┐    ┌────▼────┐      ┌─────▼──────┐
  │ Backend   │    │Frontend  │      │  Mailpit   │
  │ (NestJS)  │    │(Next.js) │      │   (Dev)    │
  └───┬──────┘    └────┬────┘      └────────────┘
      │                │
      └────────┬───────┘
               │
        ┌──────┼──────────┬──────────┐
        │      │          │          │
   ┌────▼──┐ ┌─▼─────┐ ┌─▼────┐ ┌──▼───┐
   │  PG   │ │Redis  │ │  ES  │ │Nginx │
   │  DB   │ │Cache  │ │Search│ │Conf  │
   └───────┘ └───────┘ └──────┘ └──────┘
```

## 1. docker-compose.dev.yml

Ambiente de desenvolvimento com hot reload, persistência de dados e ferramentas de debugging.

### Especificação Geral

```yaml
version: '3.9'

services:
  # PostgreSQL 18 - Banco de Dados Principal
  postgres:
    image: postgres:18.2-alpine
    container_name: miniatures_postgres_dev
    environment:
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: miniatures_dev
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.UTF-8"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
    networks:
      - miniatures_dev_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev_user -d miniatures_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Redis - Cache e Session Store
  redis:
    image: redis:7.4-alpine
    container_name: miniatures_redis_dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data_dev:/data
    command: >
      redis-server
      --appendonly yes
      --appendfilename "appendonly.aof"
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    networks:
      - miniatures_dev_net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Elasticsearch 9.3 - Search Engine
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:9.3.1
    container_name: miniatures_elasticsearch_dev
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - action.auto_create_index="+.watches,.triggered_watches,-.watches"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data_dev:/usr/share/elasticsearch/data
    networks:
      - miniatures_dev_net
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"yellow\\|green\"'"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Mailpit - Email Testing
  mailpit:
    image: axllent/mailpit:latest
    container_name: miniatures_mailpit_dev
    ports:
      - "8025:8025"  # Web UI
      - "1025:1025"  # SMTP
    volumes:
      - mailpit_data_dev:/data
    networks:
      - miniatures_dev_net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8025/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend - NestJS API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
      target: development
    container_name: miniatures_backend_dev
    environment:
      NODE_ENV: development
      APP_PORT: 3000
      DATABASE_URL: postgresql://dev_user:dev_password@postgres:5432/miniatures_dev
      REDIS_URL: redis://redis:6379/0
      ELASTICSEARCH_NODE: http://elasticsearch:9200
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      SMTP_FROM: noreply@miniatures.local
      JWT_SECRET: dev_secret_do_not_use_in_production
      JWT_EXPIRY: 24h
      REFRESH_TOKEN_SECRET: dev_refresh_secret
      REFRESH_TOKEN_EXPIRY: 7d
    ports:
      - "3000:3000"
      - "9229:9229"  # Debug port for VSCode
    volumes:
      - ./backend/src:/app/src
      - ./backend/test:/app/test
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
    networks:
      - miniatures_dev_net
    command: npm run start:dev
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Frontend - Next.js App
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
      target: development
    container_name: miniatures_frontend_dev
    environment:
      NODE_ENV: development
      NEXT_PUBLIC_API_URL: http://localhost:3000
      NEXT_PUBLIC_WEBSOCKET_URL: ws://localhost:3000
    ports:
      - "3001:3000"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/pages:/app/pages
      - ./frontend/public:/app/public
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend
    networks:
      - miniatures_dev_net
    command: npm run dev
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Nginx - Reverse Proxy (Opcional, para simular produção)
  nginx:
    image: nginx:1.27-alpine
    container_name: miniatures_nginx_dev
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/dev.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - backend
      - frontend
    networks:
      - miniatures_dev_net
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data_dev:
    driver: local
  redis_data_dev:
    driver: local
  elasticsearch_data_dev:
    driver: local
  mailpit_data_dev:
    driver: local

networks:
  miniatures_dev_net:
    driver: bridge
```

### Características Principais

**Volume Mounts para Hot Reload:**
- Backend: `/app/src` e `/app/test` montados para refletir mudanças instantaneamente
- Frontend: `/app/src`, `/app/pages`, `/app/public` para hot reload via Next.js
- Exclusão de `/app/node_modules` para evitar conflitos

**Health Checks:**
- PostgreSQL: Verifica disponibilidade via `pg_isready`
- Redis: Utiliza comando `PING`
- Elasticsearch: Verifica status do cluster (yellow ou green)
- Mailpit: Endpoint `/health`
- Backend/Frontend: HTTP health check endpoints

**Volumes Nomeados:**
- Persistem dados entre execuções
- Permitem backup e compartilhamento

**Rede Interna:**
- `miniatures_dev_net`: Bridge network para comunicação entre serviços
- DNS automático via nomes dos serviços

---

## 2. docker-compose.test.yml

Ambiente de testes rápido, efêmero e isolado com tmpfs para máxima velocidade.

### Especificação Geral

```yaml
version: '3.9'

services:
  # PostgreSQL 18 - Em Memória (tmpfs)
  postgres-test:
    image: postgres:18.2-alpine
    container_name: miniatures_postgres_test
    environment:
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: miniatures_test
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
      - /var/run/postgresql
    networks:
      - miniatures_test_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user -d miniatures_test"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s

  # Redis - Em Memória (tmpfs)
  redis-test:
    image: redis:7.4-alpine
    container_name: miniatures_redis_test
    ports:
      - "6380:6379"
    tmpfs:
      - /data
    command: redis-server --maxmemory 256mb --maxmemory-policy noeviction
    networks:
      - miniatures_test_net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Elasticsearch 9.3 - Em Memória (tmpfs)
  elasticsearch-test:
    image: docker.elastic.co/elasticsearch/elasticsearch:9.3.1
    container_name: miniatures_elasticsearch_test
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms256m -Xmx256m"
    ports:
      - "9201:9200"
    tmpfs:
      - /usr/share/elasticsearch/data
    networks:
      - miniatures_test_net
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"yellow\\|green\"'"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 15s

networks:
  miniatures_test_net:
    driver: bridge
```

### Características Principais

**tmpfs para Performance:**
- Todos os dados armazenados em RAM
- Testes rodam 10-50x mais rápido que com disco
- Sem persistência entre execuções

**Portas Diferentes:**
- PostgreSQL: 5433 (evita conflito com dev 5432)
- Redis: 6380 (evita conflito com dev 6379)
- Elasticsearch: 9201 (evita conflito com dev 9200)

**Sem Volumes Persistentes:**
- Banco limpo a cada execução
- Testes verdadeiramente isolados

**Health Checks Rápidos:**
- Intervalos de 5s (vs 10s em dev)
- Timeouts de 3s (vs 5s em dev)

---

## 3. docker-compose.prod.yml

Ambiente de produção otimizado, seguro e escalável.

### Especificação Geral

```yaml
version: '3.9'

services:
  # Backend - NestJS API (Produção)
  backend:
    image: ghcr.io/seu-org/miniatures-backend:latest
    container_name: miniatures_backend_prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      APP_PORT: 3000
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}
      REDIS_URL: redis://${REDIS_HOST}:6379/0
      ELASTICSEARCH_NODE: http://${ES_HOST}:9200
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRY: ${JWT_EXPIRY:-24h}
      REFRESH_TOKEN_SECRET: ${REFRESH_TOKEN_SECRET}
      REFRESH_TOKEN_EXPIRY: ${REFRESH_TOKEN_EXPIRY:-7d}
      CORS_ORIGIN: ${CORS_ORIGIN}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      SENTRY_DSN: ${SENTRY_DSN}
    ports:
      - "3000:3000"
    networks:
      - miniatures_prod_net
    depends_on:
      - nginx
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    logging:
      driver: json-file
      options:
        max-size: "100m"
        max-file: "10"
        labels: "service=backend"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend - Next.js App (Produção)
  frontend:
    image: ghcr.io/seu-org/miniatures-frontend:latest
    container_name: miniatures_frontend_prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NEXT_PUBLIC_WEBSOCKET_URL: ${NEXT_PUBLIC_WEBSOCKET_URL}
      NEXT_PUBLIC_ANALYTICS_ID: ${NEXT_PUBLIC_ANALYTICS_ID}
    ports:
      - "3001:3000"
    networks:
      - miniatures_prod_net
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: json-file
      options:
        max-size: "100m"
        max-file: "10"
        labels: "service=frontend"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx - Reverse Proxy / SSL Termination
  nginx:
    image: nginx:1.27-alpine
    container_name: miniatures_nginx_prod
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs/cert.pem:/etc/nginx/certs/cert.pem:ro
      - ./nginx/certs/key.pem:/etc/nginx/certs/key.pem:ro
      - nginx_cache:/var/cache/nginx
      - ./nginx/snippets:/etc/nginx/snippets:ro
    networks:
      - miniatures_prod_net
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    logging:
      driver: json-file
      options:
        max-size: "100m"
        max-file: "10"
        labels: "service=nginx"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  nginx_cache:
    driver: local

networks:
  miniatures_prod_net:
    driver: bridge
```

### Características Principais

**Apenas Aplicações:**
- Postgres, Redis e Elasticsearch rodam no host
- Comunicação via `host.docker.internal` (Docker Desktop) ou host IP
- Facilita gerenciamento centralizado em produção

**Multi-Stage Builds:**
- Imagens otimizadas e compactas
- Sem dependências de dev
- Menor superfície de ataque

**Restart Policy:**
- `unless-stopped`: Reinicia automaticamente se falhar
- Exceto se foi parado manualmente

**Resource Limits:**
- Backend: 2 CPUs, 2GB RAM (limite), 1 CPU, 1GB RAM (reserva)
- Frontend: 1 CPU, 1GB RAM (limite), 0.5 CPU, 512MB RAM (reserva)
- Nginx: 1 CPU, 512MB RAM (limite), 0.5 CPU, 256MB RAM (reserva)

**Logging Centralizado:**
- JSON-file driver
- Max-size: 100MB, max-file: 10 (rotating)
- Labels para identificação

---

## 4. backend.Dockerfile

Dockerfile multi-stage para NestJS, otimizado para produção.

### Especificação Geral

```dockerfile
# Stage 1: Dependencies
FROM node:24.4-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:24.4-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && \
    npx prisma generate

# Stage 3: Production
FROM node:24.4-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy apenas os arquivos necessários
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./.prisma
COPY --from=builder /app/package*.json ./
COPY prisma ./prisma

# Mudar propriedade
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/main.js"]
```

### Características Principais

**Multi-stage Build:**
- `deps`: Apenas dependências
- `builder`: Compilação TypeScript e Prisma
- `production`: Apenas runtime necessário

**Node.js 24 Alpine:**
- Imagem base mínima (~20MB)
- Suporte a TypeScript via Node.js nativo

**Non-root User:**
- Cria user `nodejs` (UID 1001)
- Executa processo sem privilégios root
- Melhora segurança

**npm ci vs npm install:**
- `npm ci`: Determinístico, usa package-lock.json
- Melhor para CI/CD

**Prisma Generation:**
- Gera código Prisma no build
- Necessário para runtime

**Health Check:**
- Verifica endpoint `/health`
- Startup period: 40s
- Interval: 30s

---

## 5. frontend.Dockerfile

Dockerfile multi-stage para Next.js, otimizado para produção.

### Especificação Geral

```dockerfile
# Stage 1: Dependencies
FROM node:24.4-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:24.4-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:24.4-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy apenas o necessário
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Mudar propriedade
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "server.js"]
```

### Características Principais

**Multi-stage Build:**
- `deps`: Apenas dependências
- `builder`: Next.js build com otimizações
- `runner`: Apenas o necessário para rodar

**Standalone Output:**
- Next.js compila em modo standalone
- Reduz tamanho da imagem (40MB vs 200MB+)
- Melhora tempo de startup

**Non-root User:**
- Executa como `nodejs` não-root
- Melhora segurança container

**Health Check:**
- Verifica endpoint `/health` do Next.js
- Essencial para load balancer

---

## 6. Nginx Configuration

### 6.1 nginx/dev.conf (Desenvolvimento)

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Upstream definitions
    upstream backend {
        server backend:3000;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name localhost;

        # Backend API
        location /api/ {
            proxy_pass http://backend/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 60s;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://backend/ws/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "OK";
            add_header Content-Type text/plain;
        }
    }
}
```

### 6.2 nginx/prod.conf (Produção)

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main buffer=32k flush=5s;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json;
    gzip_disable "msie6";
    gzip_comp_level 6;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;

    # Cache
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m
                     max_size=1g inactive=60m use_temp_path=off;

    # Upstream definitions
    upstream backend {
        least_conn;
        server backend:3000 weight=5;
        keepalive 32;
    }

    upstream frontend {
        least_conn;
        server frontend:3000;
        keepalive 32;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name _;

        # SSL Configuration
        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()" always;

        # Backend API
        location /api/ {
            limit_req zone=api_limit burst=200 nodelay;

            proxy_pass http://backend/;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            proxy_busy_buffers_size 8k;

            proxy_cache api_cache;
            proxy_cache_valid 200 1m;
            proxy_cache_key "$scheme$request_method$host$request_uri";
            add_header X-Cache-Status $upstream_cache_status;

            proxy_read_timeout 60s;
            proxy_connect_timeout 10s;
        }

        # Auth endpoint - Rate limit mais agressivo
        location /api/auth/ {
            limit_req zone=auth_limit burst=5 nodelay;

            proxy_pass http://backend/auth/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 30s;
        }

        # WebSocket
        location /ws/ {
            limit_req zone=api_limit burst=10 nodelay;

            proxy_pass http://backend/ws/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 86400s;
        }

        # Frontend - Assets estáticos
        location ~* ^/(_next/static|public)/ {
            proxy_pass http://frontend;
            proxy_cache_valid 200 30d;
            add_header Cache-Control "public, immutable, max-age=31536000";
            expires 30d;
        }

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "OK";
            add_header Content-Type text/plain;
        }
    }
}
```

### Recursos Principais do Nginx

**Compressão Gzip:**
- Reduz tráfego de rede em até 70%
- Desabilitado para IE6 (compatibilidade)

**Rate Limiting:**
- API: 100 requisições/segundo por IP
- Auth: 10 requisições/minuto (previne brute force)

**Caching:**
- Cache de 10MB para respostas da API
- TTL de 1 minuto
- Assets estáticos: Cache de 30 dias

**SSL/TLS:**
- HTTPS obrigatório
- Redirecionamento automático de HTTP para HTTPS
- TLS 1.2 e 1.3
- HSTS, X-Frame-Options, etc.

---

## 7. Makefile

```makefile
.PHONY: help dev test test-watch test-coverage prod logs clean seed migrate migrate-create rollback health

help:
	@echo "Comandos disponíveis:"
	@echo "  make dev              - Inicia ambiente de desenvolvimento"
	@echo "  make test             - Roda testes uma vez"
	@echo "  make test-watch       - Roda testes em modo watch"
	@echo "  make test-coverage    - Roda testes com cobertura"
	@echo "  make prod             - Inicia ambiente de produção"
	@echo "  make logs             - Mostra logs de todos os serviços"
	@echo "  make logs-backend     - Mostra logs do backend"
	@echo "  make logs-frontend    - Mostra logs do frontend"
	@echo "  make clean            - Para e remove containers, volumes"
	@echo "  make seed             - Popula banco com dados de teste"
	@echo "  make migrate          - Roda migrações Prisma"
	@echo "  make migrate-create   - Cria nova migração Prisma"
	@echo "  make rollback         - Rollback da última migração"
	@echo "  make health           - Verifica health checks"
	@echo "  make shell-backend    - Abre shell no backend"
	@echo "  make shell-frontend   - Abre shell no frontend"
	@echo "  make db-backup        - Faz backup do banco de dados"
	@echo "  make db-restore       - Restaura banco de dados"

dev:
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Ambiente de desenvolvimento iniciado!"
	@echo "Backend:     http://localhost:3000"
	@echo "Frontend:    http://localhost:3001"
	@echo "Mailpit:     http://localhost:8025"
	@echo "Elasticsearch: http://localhost:9200"

test:
	docker-compose -f docker-compose.test.yml up --abort-on-container-exit
	docker-compose -f docker-compose.test.yml down

test-watch:
	docker-compose -f docker-compose.dev.yml exec backend npm run test:watch

test-coverage:
	docker-compose -f docker-compose.test.yml up --abort-on-container-exit -d
	docker-compose -f docker-compose.test.yml exec backend npm run test:cov
	docker-compose -f docker-compose.test.yml down

prod:
	docker-compose -f docker-compose.prod.yml up -d
	@echo "Ambiente de produção iniciado!"
	@echo "Acesse: https://seu-dominio.com"

logs:
	docker-compose -f docker-compose.dev.yml logs -f

logs-backend:
	docker-compose -f docker-compose.dev.yml logs -f backend

logs-frontend:
	docker-compose -f docker-compose.dev.yml logs -f frontend

clean:
	docker-compose -f docker-compose.dev.yml down -v
	docker-compose -f docker-compose.test.yml down -v
	docker-compose -f docker-compose.prod.yml down
	@echo "Ambiente limpo!"

seed:
	docker-compose -f docker-compose.dev.yml exec backend npm run seed

migrate:
	docker-compose -f docker-compose.dev.yml exec backend npx prisma migrate deploy

migrate-create:
	@read -p "Nome da migração: " NAME; \
	docker-compose -f docker-compose.dev.yml exec backend npx prisma migrate dev --name $$NAME

rollback:
	@echo "Aviso: Rollback manual com Prisma requer SQL direto"
	docker-compose -f docker-compose.dev.yml exec postgres psql -U dev_user -d miniatures_dev

health:
	@echo "Verificando health checks..."
	@docker ps --format "{{.Names}}\t{{.State}}" | grep miniatures
	@echo ""
	@echo "Testando endpoints..."
	@curl -s http://localhost:3000/health && echo "✓ Backend OK" || echo "✗ Backend DOWN"
	@curl -s http://localhost:3001/health && echo "✓ Frontend OK" || echo "✗ Frontend DOWN"
	@curl -s http://localhost:9200/_cluster/health && echo "✓ Elasticsearch OK" || echo "✗ Elasticsearch DOWN"

shell-backend:
	docker-compose -f docker-compose.dev.yml exec backend /bin/sh

shell-frontend:
	docker-compose -f docker-compose.dev.yml exec frontend /bin/sh

db-backup:
	@mkdir -p ./backups
	docker-compose -f docker-compose.dev.yml exec postgres \
		pg_dump -U dev_user miniatures_dev > ./backups/dump_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup criado em ./backups/"

db-restore:
	@read -p "Arquivo de backup: " FILE; \
	docker-compose -f docker-compose.dev.yml exec -T postgres \
		psql -U dev_user miniatures_dev < $$FILE
	@echo "Banco restaurado!"

.DEFAULT_GOAL := help
```

---

## 8. .env.example

```env
# ============================================================================
# ENVIRONMENT
# ============================================================================
NODE_ENV=development
APP_PORT=3000
LOG_LEVEL=debug

# ============================================================================
# DATABASE (PostgreSQL)
# ============================================================================
DATABASE_URL=postgresql://dev_user:dev_password@postgres:5432/miniatures_dev
DB_USER=dev_user
DB_PASSWORD=dev_password
DB_HOST=postgres
DB_PORT=5432
DB_NAME=miniatures_dev

# ============================================================================
# CACHE (Redis)
# ============================================================================
REDIS_URL=redis://redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379

# ============================================================================
# SEARCH (Elasticsearch)
# ============================================================================
ELASTICSEARCH_NODE=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

# ============================================================================
# EMAIL (SMTP)
# ============================================================================
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@miniatures.local
SMTP_FROM_NAME=Miniaturas 3D

# ============================================================================
# AUTHENTICATION
# ============================================================================
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRY=24h
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key_change_in_production
REFRESH_TOKEN_EXPIRY=7d

# ============================================================================
# CORS
# ============================================================================
CORS_ORIGIN=http://localhost:3001,http://localhost:3000

# ============================================================================
# FRONTEND (Next.js)
# ============================================================================
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3000
NEXT_PUBLIC_ANALYTICS_ID=

# ============================================================================
# SECURITY
# ============================================================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================================================
# AWS/STORAGE (Se usar S3)
# ============================================================================
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=miniatures-uploads

# ============================================================================
# SENTRY (Error Tracking)
# ============================================================================
SENTRY_DSN=

# ============================================================================
# GITHUB (OAuth)
# ============================================================================
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ============================================================================
# GOOGLE (OAuth)
# ============================================================================
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ============================================================================
# STRIPE (Pagamentos)
# ============================================================================
STRIPE_SECRET_KEY=
STRIPE_PUBLIC_KEY=
STRIPE_WEBHOOK_SECRET=

# ============================================================================
# SERVIDOR DE PRODUÇÃO
# ============================================================================
PROD_SERVER_IP=
PROD_SERVER_USER=
PROD_SERVER_SSH_KEY=
PROD_DOMAIN=seu-dominio.com
```

---

## Estrutura de Diretórios Recomendada

```
projeto-root/
├── backend/
│   ├── src/
│   ├── test/
│   ├── prisma/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── pages/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── next.config.js
├── nginx/
│   ├── dev.conf
│   ├── prod.conf
│   ├── snippets/
│   └── certs/
│       ├── cert.pem
│       └── key.pem
├── scripts/
│   ├── init-db.sql
│   ├── seed.ts
│   └── health-check.sh
├── docker-compose.dev.yml
├── docker-compose.test.yml
├── docker-compose.prod.yml
├── Makefile
├── .env.example
└── .gitignore
```

---

## Notas Importantes

1. **Segurança em Produção:**
   - Mude TODOS os secrets (.env)
   - Use certificados SSL válidos
   - Configure firewall para liberar apenas portas 80/443
   - Mantenha imagens atualizadas

2. **Performance:**
   - Monitore uso de recursos com `docker stats`
   - Ajuste limites de CPU/memória conforme necessário
   - Use health checks agressivos em produção

3. **Persistência:**
   - Faça backup regular do PostgreSQL
   - Configure replicação para Redis em prod
   - Considere usar managed services (RDS, ElastiCache, etc.)

4. **Desenvolvimento:**
   - Use `.env.local` para overrides locais
   - Debug via porta 9229 no VSCode
   - Logs detalhados em `docker-compose logs`

