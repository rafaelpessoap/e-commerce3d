# E-Commerce de Miniaturas 3D — Guia de Implementação

**Stack:** NestJS 11 + Next.js 16.2 + PostgreSQL 18 + Redis + Elasticsearch 9.3 + Prisma 7 + TypeScript 6 + Node.js 24 + Docker + GitHub Actions

**Metodologia:** TDD Strict (teste primeiro, implementação depois)

**Estimativa:** 32 dias | 6 Fases

---

## Fase 0 — Setup do Projeto (Dia 1)

### Passo 0.1 — Criar repositório no GitHub

**Tipo:** Config
**Dependências:** Nenhuma
**Tarefas:**
1. Criar repositório público em `github.com/seu-user/miniatures-3d-ecommerce`
2. Inicializar com: Node.js .gitignore, MIT license
3. Criar branch `main` como padrão
4. Proteger `main`: require PR review, require status checks

**Validação:**
```bash
git clone https://github.com/seu-user/miniatures-3d-ecommerce.git
cd miniatures-3d-ecommerce
```

---

### Passo 0.2 — Criar estrutura de pastas raiz

**Tipo:** Config
**Arquivos a criar:** Estrutura de diretórios
**Dependências:** Repositório criado

**Estrutura:**
```
miniatures-3d-ecommerce/
├── backend/                    (NestJS)
├── frontend/                   (Next.js)
├── docs/                       (documentação)
│   ├── 01-ARCHITECTURE.md
│   ├── 02-TDD-STRATEGY.md
│   ├── 03-DATABASE-SCHEMA.md
│   ├── 04-API-CONTRACTS.md
│   ├── 05-DEPLOYMENT-GUIDE.md
│   ├── 06-TESTING-GUIDE.md
│   └── 07-IMPLEMENTATION-GUIDE.md (este arquivo)
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-staging.yml
│       └── deploy-prod.yml
├── docker-compose.dev.yml
├── docker-compose.test.yml
├── Makefile
├── .gitignore
├── .env.example
└── README.md
```

**Execução:**
```bash
cd miniatures-3d-ecommerce
mkdir -p backend frontend docs .github/workflows
touch .gitignore .env.example Makefile README.md
```

**Validação:**
```bash
ls -la
# deve mostrar todas as pastas e arquivos
```

---

### Passo 0.3 — Criar .gitignore, .env.example, Makefile

**Tipo:** Config
**Arquivos a criar:** `.gitignore`, `.env.example`, `Makefile`
**Dependências:** Estrutura de pastas criada

**.gitignore:**
```
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output/

# Environment
.env
.env.local
.env.*.local

# Build
dist/
build/
.next/
.vercel/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Docker
.docker/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Misc
.cache/
tmp/
```

**.env.example:**
```bash
# Backend
BACKEND_PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/miniatures_dev

# Redis
REDIS_URL=redis://localhost:6379

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=7d
JWT_REFRESH_EXPIRATION=30d

# AWS S3 / Cloudflare R2
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=miniatures-bucket

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@miniatures3d.com

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=your-token
MERCADOPAGO_PUBLIC_KEY=your-public-key

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_API_TIMEOUT=10000

# Admin
ADMIN_EMAIL=admin@miniatures3d.com
```

**Makefile:**
```makefile
.PHONY: help dev test lint format clean install migrate seed logs stop

help:
	@echo "Comandos disponíveis:"
	@echo "  make install     - Instala dependências de backend e frontend"
	@echo "  make dev         - Inicia ambiente de desenvolvimento (docker-compose + apps)"
	@echo "  make test        - Roda testes unitários"
	@echo "  make test:e2e    - Roda testes E2E com Playwright"
	@echo "  make lint        - Valida TypeScript e ESLint"
	@echo "  make format      - Formata código com Prettier"
	@echo "  make migrate     - Roda migrations Prisma"
	@echo "  make seed        - Popula banco com dados iniciais"
	@echo "  make logs        - Mostra logs docker-compose"
	@echo "  make clean       - Para containers e remove volumes"
	@echo "  make db-reset    - Reseta banco (CUIDADO!)"

install:
	@echo "Instalando backend..."
	cd backend && npm install
	@echo "Instalando frontend..."
	cd frontend && npm install

dev:
	@echo "Iniciando ambiente de desenvolvimento..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Aguardando serviços..."
	sleep 5
	cd backend && npm run dev &
	cd frontend && npm run dev &
	@echo "Acesse:"
	@echo "  Backend:  http://localhost:3000"
	@echo "  Frontend: http://localhost:3001"
	@echo "  Docs:     http://localhost:3000/api/docs"

test:
	cd backend && npm run test -- --coverage

test:e2e:
	cd frontend && npm run test:e2e

lint:
	cd backend && npm run lint
	cd frontend && npm run lint

format:
	cd backend && npm run format
	cd frontend && npm run format

migrate:
	cd backend && npx prisma migrate dev

seed:
	cd backend && npx prisma db seed

logs:
	docker-compose -f docker-compose.dev.yml logs -f

stop:
	docker-compose -f docker-compose.dev.yml down

clean:
	docker-compose -f docker-compose.dev.yml down -v
	rm -rf backend/dist backend/node_modules backend/.env
	rm -rf frontend/.next frontend/node_modules frontend/.env.local

db-reset:
	cd backend && npx prisma migrate reset --force
```

**Validação:**
```bash
make help
# deve listar todos os comandos
```

---

### Passo 0.4 — Inicializar backend com NestJS CLI

**Tipo:** Config
**Comandos:**
```bash
cd backend
npm install -g @nestjs/cli@latest
nest new . --package-manager npm --strict --skip-git
```

**Validação:**
```bash
ls -la backend/
# deve conter: src/, test/, node_modules/, package.json, tsconfig.json, nest-cli.json
```

---

### Passo 0.5 — Configurar TypeScript 6 no backend

**Tipo:** Config
**Arquivo:** `backend/tsconfig.json`

Atualizar `tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

**Validação:**
```bash
cd backend
npx tsc --noEmit
# sem erros
```

---

### Passo 0.6 — Instalar dependências do backend

**Tipo:** Config
**Arquivo:** `backend/package.json`

Execute na pasta `backend/`:

```bash
npm install @nestjs/core@^11.0.0 \
  @nestjs/common@^11.0.0 \
  @nestjs/platform-express@^11.0.0 \
  @nestjs/config@^4.0.0 \
  @nestjs/jwt@^12.0.0 \
  @nestjs/passport@^10.1.0 \
  @nestjs/swagger@^8.0.0 \
  @nestjs/bullmq@^6.0.0 \
  bullmq@^5.10.0 \
  @nestjs/cache-manager@^2.2.0 \
  cache-manager@^6.0.0 \
  cache-manager-redis-yet@^3.2.0 \
  prisma@^6.0.0 \
  @prisma/client@^6.0.0 \
  passport@^0.7.0 \
  passport-jwt@^4.0.0 \
  class-validator@^0.14.0 \
  class-transformer@^0.5.0 \
  bcrypt@^5.1.0 \
  @types/bcrypt@^5.0.2 \
  nodemailer@^6.9.0 \
  @types/nodemailer@^6.4.0 \
  @react-email/components@^0.1.0 \
  react-email@^3.0.0 \
  sharp@^0.32.0 \
  @aws-sdk/client-s3@^3.500.0 \
  @elastic/elasticsearch@^8.13.0 \
  slug@^6.0.0 \
  reflect-metadata@^0.1.0
```

DevDeps:
```bash
npm install --save-dev @types/express@^4.17.0 \
  @types/node@^20.0.0 \
  typescript@^6.0.0 \
  @nestjs/cli@^11.0.0 \
  jest@^29.0.0 \
  @types/jest@^29.0.0 \
  ts-jest@^29.0.0 \
  supertest@^6.3.0 \
  @types/supertest@^6.0.0 \
  @faker-js/faker@^8.0.0 \
  eslint@^8.0.0 \
  @typescript-eslint/eslint-plugin@^6.0.0 \
  @typescript-eslint/parser@^6.0.0 \
  prettier@^3.0.0
```

**Validação:**
```bash
cd backend
npm list | head -20
# deve listar todos os pacotes instalados
```

---

### Passo 0.7 — Inicializar frontend com Next.js

**Tipo:** Config
**Comando:**
```bash
cd frontend
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

**Validação:**
```bash
ls -la frontend/
# deve conter: src/, app/, node_modules/, package.json, next.config.js
```

---

### Passo 0.8 — Instalar dependências do frontend

**Tipo:** Config
**Comandos na pasta `frontend/`:**

```bash
npm install zustand@^4.0.0 \
  zod@^3.0.0 \
  @tanstack/react-query@^5.0.0 \
  lucide-react@^0.396.0 \
  @hookform/resolvers@^3.0.0 \
  react-hook-form@^7.0.0 \
  axios@^1.6.0 \
  clsx@^2.0.0 \
  tailwind-merge@^2.0.0

npx shadcn-ui@latest init -y
npm install @radix-ui/react-dialog @radix-ui/react-slot
```

DevDeps:
```bash
npm install --save-dev vitest@^1.0.0 \
  @testing-library/react@^14.0.0 \
  @testing-library/jest-dom@^6.0.0 \
  @vitejs/plugin-react@^4.0.0 \
  @playwright/test@^1.40.0 \
  @types/node@^20.0.0 \
  typescript@^6.0.0 \
  eslint-config-next@^14.0.0
```

**Validação:**
```bash
cd frontend
npm list zustand zod @tanstack/react-query
```

---

### Passo 0.9 — Criar Prisma schema inicial

**Tipo:** Config
**Arquivo:** `backend/prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String   // bcrypt hash
  role      UserRole @default(CUSTOMER)

  addresses Address[]
  orders    Order[]
  wishlist  WishlistItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

enum UserRole {
  ADMIN
  CUSTOMER
}

model Address {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  street    String
  number    String
  complement String?
  neighborhood String
  city      String
  state     String
  postalCode String
  country   String @default("BR")
  isDefault Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("addresses")
}

model Order {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  number    String   @unique // ex: ORD-2026-001
  status    OrderStatus @default(PENDING)

  items     OrderItem[]

  subtotal  Float    // antes de frete e cupom
  shipping  Float    @default(0)
  discount  Float    @default(0)
  total     Float    // calculado

  shippingAddress String? // JSON serializado
  trackingCode String?

  couponId  String?

  paymentMethod String? // mercado_pago, credit_card, pix, etc
  paymentStatus PaymentStatus @default(PENDING)
  paymentId String? // ID externo do gateway

  notes     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([status])
  @@map("orders")
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  RETURNED
}

enum PaymentStatus {
  PENDING
  APPROVED
  FAILED
  CANCELLED
}

model OrderItem {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  productId String
  product   Product  @relation(fields: [productId], references: [id])

  variationId String?
  variation   ProductVariation? @relation(fields: [variationId], references: [id])

  quantity  Int
  price     Float    // preço unitário no momento da compra
  discount  Float    @default(0)

  createdAt DateTime @default(now())

  @@map("order_items")
}

model Product {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  description String

  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  brandId   String?
  brand     Brand?   @relation(fields: [brandId], references: [id], onDelete: SetNull)

  basePrice Float    // preço base, sem escala

  tags      Tag[]    @relation("ProductToTag")
  variations ProductVariation[]
  images    ProductImage[]

  orderItems OrderItem[]
  wishlistItems WishlistItem[]

  sku       String?  @unique
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([categoryId])
  @@index([brandId])
  @@index([slug])
  @@map("products")
}

model ProductVariation {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  name      String   // ex: "Heroic Scale (28mm)"
  scaleId   String
  scale     Scale    @relation(fields: [scaleId], references: [id])

  sku       String
  price     Float    // preço com ajuste de escala
  stock     Int      @default(0)

  orderItems OrderItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([productId, scaleId])
  @@map("product_variations")
}

model ProductImage {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  url       String   // URL em R2/S3
  altText   String?
  order     Int      @default(0)

  createdAt DateTime @default(now())

  @@map("product_images")
}

model Category {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  description String?

  parentId  String?
  parent    Category? @relation("CategoryToCategory", fields: [parentId], references: [id], onDelete: SetNull)
  children  Category[] @relation("CategoryToCategory")

  products  Product[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("categories")
}

model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique

  products  Product[] @relation("ProductToTag")

  createdAt DateTime @default(now())

  @@map("tags")
}

model Brand {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  logo      String?  // URL em R2

  products  Product[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("brands")
}

model Scale {
  id        String   @id @default(cuid())
  name      String   @unique // ex: "Heroic Scale (28mm)"
  code      String   @unique // ex: "HEROIC_28"
  baseSize  Float    // tamanho base em mm
  multiplier Float   @default(1.0) // multiplicador de preço
  priority  Int      @default(0)   // para ordenação

  variations ProductVariation[]
  scaleRules ScaleRule[]

  createdAt DateTime @default(now())

  @@map("scales")
}

model ScaleRule {
  id        String   @id @default(cuid())
  scaleId   String
  scale     Scale    @relation(fields: [scaleId], references: [id], onDelete: Cascade)

  appliesTo RuleScope // PRODUCT, TAG, CATEGORY, GLOBAL
  targetId  String?   // ID do produto, tag ou categoria

  priceMultiplier Float @default(1.0)
  stockMultiplier Float @default(1.0)

  priority  Int      @default(0)

  createdAt DateTime @default(now())

  @@map("scale_rules")
}

enum RuleScope {
  GLOBAL
  CATEGORY
  TAG
  PRODUCT
}

model WishlistItem {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, productId])
  @@map("wishlist_items")
}

// Será expandido nas fases seguintes com:
// - Coupon
// - CartItem (Redis)
// - Payment, Invoice
// - Review, Rating
// - Blog (Categoria, Post)
// - SEO (Page, SeoMeta)
// - Etc.
```

**Validação:**
```bash
cd backend
npx prisma validate
# "✔ Your schema is valid"
```

---

### Passo 0.10 — Criar docker-compose.dev.yml

**Tipo:** Config
**Arquivo:** `docker-compose.dev.yml` (raiz do projeto)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:18-alpine
    container_name: miniatures_postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: miniatures_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: miniatures_redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - redis_data:/data

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:9.3.0
    container_name: miniatures_elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200 >/dev/null || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
```

**Validação:**
```bash
docker-compose -f docker-compose.dev.yml config
# deve listar todas as configurações sem erros
```

---

### Passo 0.11 — Criar docker-compose.test.yml

**Tipo:** Config
**Arquivo:** `docker-compose.test.yml` (raiz do projeto)

```yaml
version: '3.8'

services:
  postgres_test:
    image: postgres:18-alpine
    container_name: miniatures_postgres_test
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: miniatures_test
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis_test:
    image: redis:7-alpine
    container_name: miniatures_redis_test
    tmpfs:
      - /data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  elasticsearch_test:
    image: docker.elastic.co/elasticsearch/elasticsearch:9.3.0
    container_name: miniatures_elasticsearch_test
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms256m -Xmx256m
    tmpfs:
      - /usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200 >/dev/null || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Validação:**
```bash
docker-compose -f docker-compose.test.yml config
```

---

### Passo 0.12 — Subir ambiente

**Tipo:** Config
**Comando:**
```bash
make dev
```

**O que vai acontecer:**
1. Docker compose sobe (postgres, redis, elasticsearch)
2. Backend começa em modo watch na porta 3000
3. Frontend começa em modo watch na porta 3001
4. Terminal mostra logs de ambos

**Validação (em outro terminal):**
```bash
# Esperar ~30 segundos para tudo subir
curl http://localhost:3000/api/health
# {"status":"ok"}

curl http://localhost:3001
# HTML da página inicial
```

---

### Passo 0.13 — Criar migration e schema inicial

**Tipo:** Config
**Comandos:**
```bash
cd backend

# Criar arquivo .env
cp ../.env.example .env
# Editar .env para:
# DATABASE_URL=postgresql://dev:devpass@localhost:5432/miniatures_dev

# Criar migration
npx prisma migrate dev --name init

# Gerar cliente Prisma
npx prisma generate
```

**Validação:**
```bash
cd backend
npx prisma studio
# Abre interface gráfica no http://localhost:5555
# Deve mostrar todas as tabelas vazias
```

---

### Passo 0.14 — Criar primeiro teste: health check

**Tipo:** Teste
**Arquivo:** `backend/src/app.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);
  });

  describe('GET /api/health', () => {
    it('should return { status: "ok" }', () => {
      const result = { status: 'ok' };
      jest.spyOn(service, 'health').mockReturnValue(result);

      expect(controller.health()).toEqual(result);
    });
  });
});
```

**Arquivo:** `backend/src/app.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health(): { status: string } {
    return { status: 'ok' };
  }
}
```

**Arquivo:** `backend/src/app.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health(): { status: string } {
    return this.appService.health();
  }
}
```

**Validação:**
```bash
cd backend
npm run test -- app.controller.spec.ts
# PASS  src/app.controller.spec.ts
```

---

### Passo 0.15 — Rodar testes

**Tipo:** Validação
**Comando:**
```bash
cd backend
npm run test -- --coverage

# Esperado:
# PASS  src/app.controller.spec.ts
# PASS  src/app.service.spec.ts
# ✓ 2 suites, 2 tests, 0 failures
```

---

### Passo 0.16 — Criar CI básico no GitHub Actions

**Tipo:** Config
**Arquivo:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: miniatures_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: cd backend && npm ci

      - name: Generate Prisma client
        run: cd backend && npx prisma generate

      - name: Run linter
        run: cd backend && npm run lint

      - name: Run tests
        run: cd backend && npm run test -- --coverage
        env:
          DATABASE_URL: postgresql://test:testpass@localhost:5432/miniatures_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/coverage-final.json

  frontend:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run linter
        run: cd frontend && npm run lint

      - name: Build
        run: cd frontend && npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3000
```

---

### Passo 0.17 — Commit inicial e push

**Tipo:** Config
**Comandos:**
```bash
git add .
git commit -m "chore: initial project setup with NestJS, Next.js, PostgreSQL, Redis, Elasticsearch"
git push origin main
```

**Validação:**
1. GitHub Actions deve rodar CI automaticamente
2. Todos os jobs devem passar (verde)
3. Coverage deve estar acima de 80%

---

## Critério de Conclusão da Fase 0

✓ `make dev` sobe tudo com sucesso
✓ `npm run test` no backend passa 100%
✓ GitHub Actions CI fica verde
✓ Acessar http://localhost:3000/api/health retorna `{"status":"ok"}`
✓ Acessar http://localhost:3001 mostra página inicial Next.js
✓ Prisma Studio em http://localhost:5555 mostra todas as tabelas

---

## Fase 1 — Autenticação (Dias 2-4)

### Passo 1.1 — Estender Prisma schema para autenticação

**Tipo:** Config
**Arquivo:** `backend/prisma/schema.prisma`

Expandir modelo `User`:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String   // bcrypt hash
  role      UserRole @default(CUSTOMER)

  // Autenticação
  emailVerified Boolean @default(false)
  emailVerificationToken String? @unique
  emailVerificationExpires DateTime?

  passwordResetToken String? @unique
  passwordResetExpires DateTime?

  lastLoginAt DateTime?

  addresses Address[]
  orders    Order[]
  wishlist  WishlistItem[]
  refreshTokens RefreshToken[]

  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  token     String   @unique
  expiresAt DateTime

  createdAt DateTime @default(now())

  @@map("refresh_tokens")
}
```

**Validação:**
```bash
cd backend
npx prisma migrate dev --name add_auth_fields
```

---

### Passo 1.2 — TESTE: AuthService.register()

**Tipo:** Teste
**Arquivo:** `backend/src/auth/auth.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: '1',
        email: dto.email,
        name: dto.name,
        password: 'hashedpassword',
        role: 'CUSTOMER',
        emailVerified: false,
        createdAt: new Date(),
      });

      const result = await service.register(dto);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe(dto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
    });

    it('should throw BadRequestException for duplicate email', async () => {
      const dto = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: dto.email,
      });

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for weak password', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User',
      };

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });

    it('should validate email format', async () => {
      const dto = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
```

**Validação:**
```bash
cd backend
npm run test -- auth.service.spec.ts
# FAIL (esperado - AuthService ainda não existe)
```

---

### Passo 1.3 — IMPLEMENTAR: AuthService.register()

**Tipo:** Implementação
**Arquivo:** `backend/src/auth/auth.service.ts`

```typescript
import {
  BadRequestException,
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePassword(password: string): boolean {
    // Mínimo 8 caracteres, pelo menos 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  async register(dto: RegisterDto) {
    // Validar email
    if (!this.validateEmail(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validar password
    if (!this.validatePassword(dto.password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
      );
    }

    // Verificar se email já existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Criar usuário
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: 'CUSTOMER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }
}
```

**Arquivo:** `backend/src/auth/dto/register.dto.ts`

```typescript
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
```

**Validação:**
```bash
cd backend
npm run test -- auth.service.spec.ts
# PASS: todas os testes passam
```

---

### Passo 1.4 — TESTE: AuthService.login()

**Tipo:** Teste
**Arquivo:** `backend/src/auth/auth.service.spec.ts` (adicionar)

```typescript
describe('login', () => {
  it('should return tokens with valid credentials', async () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const hashedPassword = await bcrypt.hash(loginDto.password, 10);
    const user = {
      id: '1',
      email: loginDto.email,
      password: hashedPassword,
      role: 'CUSTOMER',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jest.spyOn(service, 'generateTokens').mockResolvedValue({
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
    });

    const result = await service.login(loginDto);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('should throw for invalid email', async () => {
    const loginDto = {
      email: 'nonexistent@example.com',
      password: 'SecurePass123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.login(loginDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw for wrong password', async () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'WrongPassword123!',
    };

    const user = {
      id: '1',
      email: loginDto.email,
      password: 'hashedcorrectpassword',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(loginDto)).rejects.toThrow(
      BadRequestException,
    );
  });
});
```

---

### Passo 1.5 — IMPLEMENTAR: AuthService.login()

**Tipo:** Implementação
**Arquivo:** `backend/src/auth/auth.service.ts` (adicionar método)

```typescript
async login(dto: { email: string; password: string }) {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });

  if (!user) {
    throw new BadRequestException('Invalid email or password');
  }

  const passwordMatch = await bcrypt.compare(dto.password, user.password);
  if (!passwordMatch) {
    throw new BadRequestException('Invalid email or password');
  }

  const tokens = await this.generateTokens(user.id);

  // Salvar refresh token no banco
  await this.prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
    },
  });

  // Atualizar lastLoginAt
  await this.prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

private async generateTokens(userId: string) {
  // Será implementado com JWT no próximo passo
  return {
    accessToken: 'placeholder',
    refreshToken: 'placeholder',
  };
}
```

**Validação:**
```bash
cd backend
npm run test -- auth.service.spec.ts
# PASS
```

---

### Passo 1.6 — Configurar JWT e Environment

**Tipo:** Config
**Arquivo:** `backend/src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
```

**Arquivo:** `backend/src/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }
}
```

---

### Passo 1.7 — IMPLEMENTAR: AuthService.generateTokens() com JWT

**Tipo:** Implementação
**Arquivo:** `backend/src/auth/auth.service.ts` (atualizar método)

```typescript
import { JwtService } from '@nestjs/jwt';

constructor(
  private prisma: PrismaService,
  private jwtService: JwtService,
) {}

private async generateTokens(userId: string) {
  const payload = { sub: userId };

  const accessToken = this.jwtService.sign(payload, {
    expiresIn: '7d',
  });

  const refreshToken = this.jwtService.sign(payload, {
    expiresIn: '30d',
  });

  return { accessToken, refreshToken };
}
```

**Validação:**
```bash
cd backend
npm run test -- auth.service.spec.ts
# PASS
```

---

### Passo 1.8 — TESTE: AuthService.refreshToken()

**Tipo:** Teste
**Arquivo:** `backend/src/auth/auth.service.spec.ts` (adicionar)

```typescript
describe('refreshToken', () => {
  it('should return new tokens with valid refresh token', async () => {
    const refreshToken = 'valid_refresh_token';
    const userId = '1';

    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      userId,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    jest.spyOn(service, 'generateTokens').mockResolvedValue({
      accessToken: 'new_access_token',
      refreshToken: 'new_refresh_token',
    });

    const result = await service.refreshToken(refreshToken);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('should throw for expired refresh token', async () => {
    const refreshToken = 'expired_refresh_token';

    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      userId: '1',
      expiresAt: new Date(Date.now() - 1000), // Expirado
    });

    await expect(service.refreshToken(refreshToken)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw for invalid refresh token', async () => {
    const refreshToken = 'invalid_refresh_token';

    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.refreshToken(refreshToken)).rejects.toThrow(
      BadRequestException,
    );
  });
});
```

---

### Passo 1.9 — IMPLEMENTAR: AuthService.refreshToken()

**Tipo:** Implementação
**Arquivo:** `backend/src/auth/auth.service.ts` (adicionar método)

```typescript
async refreshToken(token: string) {
  const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!refreshTokenRecord || refreshTokenRecord.expiresAt < new Date()) {
    throw new BadRequestException('Invalid or expired refresh token');
  }

  const tokens = await this.generateTokens(refreshTokenRecord.userId);

  // Invalidar token antigo
  await this.prisma.refreshToken.delete({
    where: { token },
  });

  // Salvar novo refresh token
  await this.prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: refreshTokenRecord.userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}
```

**Validação:**
```bash
cd backend
npm run test -- auth.service.spec.ts
# PASS
```

---

### Passo 1.10 — TESTE: AuthController endpoints

**Tipo:** Teste
**Arquivo:** `backend/src/auth/auth.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  describe('POST /auth/register', () => {
    it('should return user data', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const result = {
        id: '1',
        email: dto.email,
        name: dto.name,
        role: 'CUSTOMER',
      };

      (service.register as jest.Mock).mockResolvedValue(result);

      expect(await controller.register(dto)).toEqual(result);
    });
  });

  describe('POST /auth/login', () => {
    it('should return access and refresh tokens', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const result = {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: { id: '1', email: dto.email },
      };

      (service.login as jest.Mock).mockResolvedValue(result);

      expect(await controller.login(dto)).toEqual(result);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new tokens', async () => {
      const result = {
        accessToken: 'new_token',
        refreshToken: 'new_refresh',
      };

      (service.refreshToken as jest.Mock).mockResolvedValue(result);

      expect(await controller.refreshToken('old_refresh')).toEqual(result);
    });
  });
});
```

---

### Passo 1.11 — IMPLEMENTAR: AuthController

**Tipo:** Implementação
**Arquivo:** `backend/src/auth/auth.controller.ts`

```typescript
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body()
    dto: {
      email: string;
      password: string;
    },
  ) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() dto: { refreshToken: string }) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout (invalidate refresh token)' })
  async logout(@Request() req: any) {
    // Será implementado depois se necessário
    return { message: 'Logout successful' };
  }
}
```

**Validação:**
```bash
cd backend
npm run test -- auth.controller.spec.ts
# PASS
```

---

### Passo 1.12 — TESTE: JWT Guard

**Tipo:** Teste
**Arquivo:** `backend/src/auth/guards/jwt-auth.guard.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow requests with valid JWT', async () => {
    const mockExecutionContext: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          user: { id: '1', email: 'test@example.com' },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(mockExecutionContext)).toBeDefined();
  });
});
```

---

### Passo 1.13 — IMPLEMENTAR: JWT Guard

**Tipo:** Implementação
**Arquivo:** `backend/src/auth/guards/jwt-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Arquivo:** `backend/src/auth/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.includes(user?.role);
  }
}
```

**Arquivo:** `backend/src/auth/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

---

### Passo 1.14 — TESTE: UsersService

**Tipo:** Teste
**Arquivo:** `backend/src/users/users.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const userId = '1';
      const user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.getProfile(userId);

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const userId = '1';
      const updateDto = {
        name: 'Updated Name',
        email: 'newemail@example.com',
      };

      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: userId,
        ...updateDto,
      });

      const result = await service.updateProfile(userId, updateDto);

      expect(result.name).toBe(updateDto.name);
    });
  });
});
```

---

### Passo 1.15 — IMPLEMENTAR: UsersService

**Tipo:** Implementação
**Arquivo:** `backend/src/users/users.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: { name?: string; email?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return user;
  }

  async getAllUsers(skip = 0, take = 10) {
    return this.prisma.user.findMany({
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserCount() {
    return this.prisma.user.count();
  }
}
```

**Arquivo:** `backend/src/users/users.controller.ts`

```typescript
import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateProfile(@Request() req: any, @Body() dto: any) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }
}
```

**Arquivo:** `backend/src/users/users.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
```

---

### Passo 1.16 — TESTE: AddressesService

**Tipo:** Teste
**Arquivo:** `backend/src/addresses/addresses.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AddressesService } from './addresses.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AddressesService', () => {
  let service: AddressesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        {
          provide: PrismaService,
          useValue: {
            address: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createAddress', () => {
    it('should create a new address', async () => {
      const userId = '1';
      const dto = {
        street: 'Rua A',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01310-100',
        country: 'BR',
        isDefault: false,
      };

      const createdAddress = { id: '1', userId, ...dto };

      (prisma.address.create as jest.Mock).mockResolvedValue(createdAddress);

      const result = await service.createAddress(userId, dto);

      expect(result).toEqual(createdAddress);
    });
  });

  describe('getAddresses', () => {
    it('should return all addresses for user', async () => {
      const userId = '1';
      const addresses = [
        {
          id: '1',
          userId,
          street: 'Rua A',
          number: '123',
          city: 'São Paulo',
          state: 'SP',
          isDefault: true,
        },
      ];

      (prisma.address.findMany as jest.Mock).mockResolvedValue(addresses);

      const result = await service.getAddresses(userId);

      expect(result).toEqual(addresses);
    });
  });
});
```

---

### Passo 1.17 — IMPLEMENTAR: AddressesService

**Tipo:** Implementação
**Arquivo:** `backend/src/addresses/addresses.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async createAddress(userId: string, dto: any) {
    // Se isDefault = true, remover isDefault de outras
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async getDefaultAddress(userId: string) {
    return this.prisma.address.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async updateAddress(userId: string, addressId: string, dto: any) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: dto,
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    return this.prisma.address.delete({
      where: { id: addressId },
    });
  }
}
```

**Arquivo:** `backend/src/addresses/addresses.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('addresses')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressesController {
  constructor(private addressesService: AddressesService) {}

  @Get()
  async getAddresses(@Request() req: any) {
    return this.addressesService.getAddresses(req.user.id);
  }

  @Post()
  async createAddress(@Request() req: any, @Body() dto: any) {
    return this.addressesService.createAddress(req.user.id, dto);
  }

  @Patch(':id')
  async updateAddress(
    @Request() req: any,
    @Param('id') addressId: string,
    @Body() dto: any,
  ) {
    return this.addressesService.updateAddress(req.user.id, addressId, dto);
  }

  @Delete(':id')
  async deleteAddress(@Request() req: any, @Param('id') addressId: string) {
    return this.addressesService.deleteAddress(req.user.id, addressId);
  }
}
```

**Arquivo:** `backend/src/addresses/addresses.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AddressesController],
  providers: [AddressesService, PrismaService],
})
export class AddressesModule {}
```

---

### Passo 1.18 — Integração no App Module

**Tipo:** Config
**Arquivo:** `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    AuthModule,
    UsersModule,
    AddressesModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
```

---

### Passo 1.19 — TESTE DE INTEGRAÇÃO: Auth flow completo

**Tipo:** Integração
**Arquivo:** `backend/src/auth/auth.integration.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Auth Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('should complete full auth flow: register -> login -> refresh', async () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    };

    // Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerDto)
      .expect(201);

    expect(registerRes.body).toHaveProperty('id');
    expect(registerRes.body.email).toBe(registerDto.email);

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: registerDto.email,
        password: registerDto.password,
      })
      .expect(200);

    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body).toHaveProperty('refreshToken');

    const { accessToken, refreshToken } = loginRes.body;

    // Get Profile (protected route)
    const profileRes = await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profileRes.body.email).toBe(registerDto.email);

    // Refresh Token
    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(refreshRes.body).toHaveProperty('accessToken');
    expect(refreshRes.body.accessToken).not.toBe(accessToken); // Deve ser diferente
  });
});
```

**Validação:**
```bash
cd backend
npm run test -- auth.integration.spec.ts
# PASS: Fluxo completo de auth funcionando
```

---

### Passo 1.20 — Rodar todos os testes da Fase 1

**Tipo:** Validação
**Comando:**
```bash
cd backend
npm run test -- --testPathPattern="auth|users|addresses" --coverage

# Esperado:
# PASS  src/auth/auth.service.spec.ts
# PASS  src/auth/auth.controller.spec.ts
# PASS  src/auth/auth.integration.spec.ts
# PASS  src/users/users.service.spec.ts
# PASS  src/addresses/addresses.service.spec.ts
# ✓ 10 suites, 50+ tests, all passing
# Cobertura: >90%
```

---

### Passo 1.21 — Commit da Fase 1

**Tipo:** Config
**Comando:**
```bash
git add .
git commit -m "feat: complete authentication system with JWT, users, addresses"
git push origin main
```

---

## Critério de Conclusão da Fase 1

✓ Login, registro, refresh token funcionando
✓ JWT válido em todas as rotas protegidas
✓ Guards de role (ADMIN/CUSTOMER) funcionando
✓ Endereços do usuário sendo gerenciados
✓ Cobertura de testes > 90%
✓ CI no GitHub passando
✓ Testes de integração cobrindo fluxo completo

---

## Fase 2 — Catálogo de Produtos (Dias 5-10)

### Passo 2.1 — Expandir Prisma schema para produtos

**Tipo:** Config
**Arquivo:** `backend/prisma/schema.prisma` (adicionar tabelas)

```prisma
model Scale {
  id        String   @id @default(cuid())
  name      String   @unique // ex: "Heroic Scale (28mm)"
  code      String   @unique // ex: "HEROIC_28"
  baseSize  Float    // tamanho base em mm
  multiplier Float   @default(1.0) // multiplicador de preço
  priority  Int      @default(0)   // para ordenação

  variations ProductVariation[]
  scaleRules ScaleRule[]

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([code])
  @@map("scales")
}

model ScaleRule {
  id        String   @id @default(cuid())
  scaleId   String
  scale     Scale    @relation(fields: [scaleId], references: [id], onDelete: Cascade)

  appliesTo RuleScope // PRODUCT, TAG, CATEGORY, GLOBAL
  targetId  String?   // ID do produto, tag ou categoria

  priceMultiplier Float @default(1.0)
  stockMultiplier Float @default(1.0)

  priority  Int      @default(0)

  createdAt DateTime @default(now())

  @@map("scale_rules")
}

enum RuleScope {
  GLOBAL
  CATEGORY
  TAG
  PRODUCT
}

model Category {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  description String?
  image     String?  // URL em R2

  parentId  String?
  parent    Category? @relation("CategoryToCategory", fields: [parentId], references: [id], onDelete: SetNull)
  children  Category[] @relation("CategoryToCategory")

  products  Product[]

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
  @@map("categories")
}

model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  color     String?  // Hex color

  products  Product[] @relation("ProductToTag")

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([slug])
  @@map("tags")
}

model Brand {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  logo      String?  // URL em R2
  description String?

  products  Product[]

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
  @@map("brands")
}

model Product {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  description String   @db.Text
  content   String?  @db.Text // Descrição longa, HTML

  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  brandId   String?
  brand     Brand?   @relation(fields: [brandId], references: [id], onDelete: SetNull)

  basePrice Float    // preço base, sem escala

  tags      Tag[]    @relation("ProductToTag")
  variations ProductVariation[]
  images    ProductImage[]

  orderItems OrderItem[]
  wishlistItems WishlistItem[]

  sku       String?  @unique
  isActive  Boolean  @default(true)
  featured  Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([categoryId])
  @@index([brandId])
  @@index([slug])
  @@fulltext([name, description]) // Para MySQL, comentar se usar PostgreSQL
  @@map("products")
}

model ProductVariation {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  name      String   // ex: "Heroic Scale (28mm)"
  scaleId   String
  scale     Scale    @relation(fields: [scaleId], references: [id])

  sku       String
  price     Float    // preço com ajuste de escala
  stock     Int      @default(0)

  orderItems OrderItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([productId, scaleId])
  @@index([scaleId])
  @@map("product_variations")
}

model ProductImage {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  url       String   // URL em R2/S3
  altText   String?
  order     Int      @default(0)
  isMain    Boolean  @default(false)

  createdAt DateTime @default(now())

  @@index([productId])
  @@map("product_images")
}
```

**Validação:**
```bash
cd backend
npx prisma migrate dev --name add_catalog_schema
npx prisma generate
```

---

### Passo 2.2 — TESTE: CategoriesService

**Tipo:** Teste
**Arquivo:** `backend/src/catalog/categories/categories.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create category with auto-slug', async () => {
      const dto = {
        name: 'Fantasy Miniatures',
        description: 'Miniaturas fantasia',
      };

      const expectedCategory = {
        id: '1',
        ...dto,
        slug: 'fantasy-miniatures',
        parentId: null,
        isActive: true,
      };

      (prisma.category.create as jest.Mock).mockResolvedValue(
        expectedCategory,
      );

      const result = await service.create(dto);

      expect(result.slug).toBe('fantasy-miniatures');
      expect(prisma.category.create).toHaveBeenCalled();
    });

    it('should create nested category with parentId', async () => {
      const dto = {
        name: 'Elves',
        description: 'Elfos',
        parentId: 'fantasy-id',
      };

      (prisma.category.create as jest.Mock).mockResolvedValue({
        id: '2',
        ...dto,
        slug: 'elves',
      });

      const result = await service.create(dto);

      expect(result.parentId).toBe('fantasy-id');
    });
  });

  describe('findAll', () => {
    it('should return all categories with hierarchy', async () => {
      const categories = [
        {
          id: '1',
          name: 'Fantasy',
          slug: 'fantasy',
          children: [
            { id: '2', name: 'Elves', slug: 'elves', children: [] },
          ],
        },
      ];

      (prisma.category.findMany as jest.Mock).mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
    });
  });

  describe('findBySlug', () => {
    it('should find category by slug with products count', async () => {
      const category = {
        id: '1',
        name: 'Fantasy',
        slug: 'fantasy',
        _count: { products: 5 },
      };

      (prisma.category.findUnique as jest.Mock).mockResolvedValue(category);

      const result = await service.findBySlug('fantasy');

      expect(result.slug).toBe('fantasy');
    });
  });
});
```

---

### Passo 2.3 — IMPLEMENTAR: CategoriesService

**Tipo:** Implementação
**Arquivo:** `backend/src/catalog/categories/categories.service.ts`

```typescript
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import slug from 'slug';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    name: string;
    description?: string;
    image?: string;
    parentId?: string;
  }) {
    const slugified = slug(dto.name, { lower: true });

    // Verificar slug duplicado
    const existing = await this.prisma.category.findUnique({
      where: { slug: slugified },
    });

    if (existing) {
      throw new ConflictException('Category name already exists');
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: slugified,
        description: dto.description,
        image: dto.image,
        parentId: dto.parentId,
      },
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: {
        children: {
          where: { isActive: true },
          include: {
            _count: { select: { products: true } },
          },
        },
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          where: { isActive: true },
        },
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    dto: {
      name?: string;
      description?: string;
      image?: string;
    },
  ) {
    let data: any = { ...dto };

    if (dto.name) {
      data.slug = slug(dto.name, { lower: true });
    }

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }
}
```

---

### Passo 2.4 — TESTE: ScalesService (CRÍTICO)

**Tipo:** Teste
**Arquivo:** `backend/src/catalog/scales/scales.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ScalesService } from './scales.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ScalesService', () => {
  let service: ScalesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScalesService,
        {
          provide: PrismaService,
          useValue: {
            scale: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            scaleRule: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ScalesService>(ScalesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('calculatePrice', () => {
    it('should apply product-level scale rule', async () => {
      const basePrice = 100;
      const productId = 'prod-1';
      const scaleId = 'scale-1';

      const rules = [
        { appliesTo: 'PRODUCT', targetId: productId, priceMultiplier: 1.5, priority: 10 },
        { appliesTo: 'CATEGORY', targetId: 'cat-1', priceMultiplier: 1.2, priority: 5 },
        { appliesTo: 'GLOBAL', targetId: null, priceMultiplier: 1.1, priority: 1 },
      ];

      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue(rules);

      const price = await service.calculatePrice(basePrice, productId, scaleId, 'cat-1');

      // Product rule tem priority 10 (maior), deve usar 1.5
      expect(price).toBe(basePrice * 1.5);
    });

    it('should apply category-level rule when product rule missing', async () => {
      const basePrice = 100;
      const productId = 'prod-2';
      const scaleId = 'scale-1';
      const categoryId = 'cat-1';

      const rules = [
        { appliesTo: 'CATEGORY', targetId: categoryId, priceMultiplier: 1.2, priority: 5 },
        { appliesTo: 'GLOBAL', targetId: null, priceMultiplier: 1.1, priority: 1 },
      ];

      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue(rules);

      const price = await service.calculatePrice(basePrice, productId, scaleId, categoryId);

      expect(price).toBe(basePrice * 1.2);
    });

    it('should fallback to GLOBAL rule', async () => {
      const basePrice = 100;
      const productId = 'prod-3';
      const scaleId = 'scale-1';

      const rules = [
        { appliesTo: 'GLOBAL', targetId: null, priceMultiplier: 1.1, priority: 1 },
      ];

      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue(rules);

      const price = await service.calculatePrice(basePrice, productId, scaleId, 'cat-1');

      expect(price).toBe(basePrice * 1.1);
    });

    it('should use base price when no rules exist', async () => {
      const basePrice = 100;

      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([]);

      const price = await service.calculatePrice(basePrice, 'prod-4', 'scale-1', 'cat-1');

      expect(price).toBe(basePrice);
    });
  });
});
```

---

### Passo 2.5 — IMPLEMENTAR: ScalesService

**Tipo:** Implementação
**Arquivo:** `backend/src/catalog/scales/scales.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ScalesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    name: string;
    code: string;
    baseSize: number;
    multiplier?: number;
    priority?: number;
  }) {
    return this.prisma.scale.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        baseSize: dto.baseSize,
        multiplier: dto.multiplier || 1.0,
        priority: dto.priority || 0,
      },
    });
  }

  async findAll() {
    return this.prisma.scale.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * CRÍTICO: Calcula preço baseado em regras de escala
   * Ordem de prioridade: PRODUCT > TAG > CATEGORY > GLOBAL
   */
  async calculatePrice(
    basePrice: number,
    productId: string,
    scaleId: string,
    categoryId?: string,
  ): Promise<number> {
    // Buscar todas as regras de escala aplicáveis
    const rules = await this.prisma.scaleRule.findMany({
      where: {
        scaleId,
        OR: [
          { appliesTo: 'PRODUCT', targetId: productId },
          { appliesTo: 'CATEGORY', targetId: categoryId },
          { appliesTo: 'GLOBAL' },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      return basePrice;
    }

    // A primeira regra (com priority mais alta) é a que se aplica
    const applicableRule = rules[0];
    return Math.round(basePrice * applicableRule.priceMultiplier * 100) / 100;
  }

  /**
   * CRÍTICO: Calcula estoque baseado em regras de escala
   */
  async calculateStock(
    baseStock: number,
    productId: string,
    scaleId: string,
    categoryId?: string,
  ): Promise<number> {
    const rules = await this.prisma.scaleRule.findMany({
      where: {
        scaleId,
        OR: [
          { appliesTo: 'PRODUCT', targetId: productId },
          { appliesTo: 'CATEGORY', targetId: categoryId },
          { appliesTo: 'GLOBAL' },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      return baseStock;
    }

    const applicableRule = rules[0];
    return Math.floor(baseStock * applicableRule.stockMultiplier);
  }

  async createRule(dto: {
    scaleId: string;
    appliesTo: 'GLOBAL' | 'CATEGORY' | 'TAG' | 'PRODUCT';
    targetId?: string;
    priceMultiplier?: number;
    stockMultiplier?: number;
    priority?: number;
  }) {
    return this.prisma.scaleRule.create({
      data: {
        scaleId: dto.scaleId,
        appliesTo: dto.appliesTo,
        targetId: dto.targetId,
        priceMultiplier: dto.priceMultiplier || 1.0,
        stockMultiplier: dto.stockMultiplier || 1.0,
        priority: dto.priority || 0,
      },
    });
  }
}
```

---

### Passo 2.6 — TESTE: ProductsService

**Tipo:** Teste
**Arquivo:** `backend/src/catalog/products/products.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;
  let scalesService: ScalesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        ScalesService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            productVariation: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
    scalesService = module.get<ScalesService>(ScalesService);
  });

  describe('create', () => {
    it('should create product with auto-slug', async () => {
      const dto = {
        name: 'Fantasy Warrior',
        description: 'Epic warrior figure',
        basePrice: 50,
      };

      (prisma.product.create as jest.Mock).mockResolvedValue({
        id: 'prod-1',
        ...dto,
        slug: 'fantasy-warrior',
      });

      const result = await service.create(dto);

      expect(result.slug).toBe('fantasy-warrior');
    });

    it('should reject duplicate slug', async () => {
      const dto = {
        name: 'Fantasy Warrior',
        description: 'Epic warrior figure',
        basePrice: 50,
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
      });

      await expect(service.create(dto)).rejects.toThrow();
    });
  });

  describe('createVariation', () => {
    it('should create variation with calculated price', async () => {
      const productId = 'prod-1';
      const scaleId = 'scale-1';

      jest.spyOn(scalesService, 'calculatePrice').mockResolvedValue(75);

      (prisma.productVariation.create as jest.Mock).mockResolvedValue({
        id: 'var-1',
        productId,
        scaleId,
        price: 75,
        stock: 100,
      });

      const result = await service.createVariation(productId, scaleId, 100);

      expect(result.price).toBe(75);
    });
  });

  describe('findBySlug', () => {
    it('should return product with all variations and images', async () => {
      const product = {
        id: 'prod-1',
        name: 'Fantasy Warrior',
        slug: 'fantasy-warrior',
        variations: [
          { id: 'var-1', scaleId: 'scale-1', price: 75 },
        ],
        images: [
          { id: 'img-1', url: 'https://...', isMain: true },
        ],
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(product);

      const result = await service.findBySlug('fantasy-warrior');

      expect(result.variations).toHaveLength(1);
      expect(result.images).toHaveLength(1);
    });
  });
});
```

---

### Passo 2.7 — IMPLEMENTAR: ProductsService

**Tipo:** Implementação
**Arquivo:** `backend/src/catalog/products/products.service.ts`

```typescript
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import slug from 'slug';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private scalesService: ScalesService,
  ) {}

  async create(dto: {
    name: string;
    description: string;
    content?: string;
    basePrice: number;
    categoryId?: string;
    brandId?: string;
    tagIds?: string[];
    sku?: string;
  }) {
    const slugified = slug(dto.name, { lower: true });

    const existing = await this.prisma.product.findUnique({
      where: { slug: slugified },
    });

    if (existing) {
      throw new ConflictException('Product name already exists');
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug: slugified,
        description: dto.description,
        content: dto.content,
        basePrice: dto.basePrice,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        sku: dto.sku,
        tags: dto.tagIds
          ? {
              connect: dto.tagIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        category: true,
        brand: true,
        tags: true,
      },
    });
  }

  async createVariation(
    productId: string,
    scaleId: string,
    stock: number,
    customPrice?: number,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Calcular preço com regras de escala
    const calculatedPrice =
      customPrice ||
      (await this.scalesService.calculatePrice(
        product.basePrice,
        productId,
        scaleId,
        product.categoryId,
      ));

    const scale = await this.prisma.scale.findUnique({
      where: { id: scaleId },
    });

    if (!scale) {
      throw new NotFoundException('Scale not found');
    }

    return this.prisma.productVariation.create({
      data: {
        productId,
        scaleId,
        name: scale.name,
        sku: `${product.sku || productId}-${scale.code}`,
        price: calculatedPrice,
        stock,
      },
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        brand: true,
        tags: true,
        variations: {
          include: { scale: true },
          orderBy: { scale: { priority: 'desc' } },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { orderItems: true, wishlistItems: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async search(query: string, skip = 0, take = 20) {
    return this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      include: {
        category: true,
        brand: true,
        images: {
          where: { isMain: true },
          take: 1,
        },
        variations: {
          select: { price: true },
          take: 1,
          orderBy: { scale: { priority: 'desc' } },
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCategory(categorySlug: string, skip = 0, take = 20) {
    return this.prisma.product.findMany({
      where: {
        category: { slug: categorySlug },
        isActive: true,
      },
      include: {
        brand: true,
        images: {
          where: { isMain: true },
          take: 1,
        },
        variations: {
          select: { price: true },
          take: 1,
          orderBy: { scale: { priority: 'desc' } },
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

---

### Passo 2.8 — Controllers e Módulos

**Tipo:** Implementação
**Arquivo:** `backend/src/catalog/catalog.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { CategoriesService } from './categories/categories.service';
import { CategoriesController } from './categories/categories.controller';
import { ProductsService } from './products/products.service';
import { ProductsController } from './products/products.controller';
import { ScalesService } from './scales/scales.service';
import { ScalesController } from './scales/scales.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [
    CategoriesService,
    ProductsService,
    ScalesService,
    PrismaService,
  ],
  controllers: [CategoriesController, ProductsController, ScalesController],
  exports: [CategoriesService, ProductsService, ScalesService],
})
export class CatalogModule {}
```

---

### Passo 2.9 — Rodar todos os testes da Fase 2 até aqui

**Tipo:** Validação
**Comando:**
```bash
cd backend
npm run test -- --testPathPattern="catalog" --coverage

# Esperado:
# PASS  src/catalog/categories/categories.service.spec.ts
# PASS  src/catalog/products/products.service.spec.ts
# PASS  src/catalog/scales/scales.service.spec.ts
# ✓ 3 suites, 20+ tests, all passing
# Cobertura: >90%
```

---

## Resumo até aqui: Fase 0 + Fase 1 + Fase 2 (Parcial)

Neste ponto você tem:

✓ **Fase 0:** Setup completo, CI/CD verde
✓ **Fase 1:** Autenticação, JWT, usuários, endereços
✓ **Fase 2 (Parcial):** Categorias, produtos, escalas, regras de preço

---

## Para continuar (Fases 3-6)

As Fases 3-6 seguem o mesmo padrão:

1. **TESTE primeiro** (testes falham, RED)
2. **Implementação mínima** (testes passam, GREEN)
3. **Refatoração** (melhor código)
4. **Integração** (com sistema)

---

# Dicas para o Claude Code (VSCode)

## Como formular prompts para máximo produtividade

### Padrão 1: Implementar um teste

```
Crie o teste [ARQUIVO].spec.ts para [FUNCIONALIDADE] com os casos:
- Caso 1: [descrição]
- Caso 2: [descrição]
- Caso 3: [descrição]

Use o padrão do arquivo 02-TDD-STRATEGY.md:
- beforeEach para setup
- jest.fn() para mocks
- expect().toHaveBeenCalledWith() para assertions

Referência: Ver padrão em auth.service.spec.ts (Passo 1.2)
```

### Padrão 2: Implementar funcionalidade

```
Implemente [ARQUIVO].ts para passar nos testes de [TESTE_FILE].spec.ts

Requisitos:
- Validações conforme TDD-STRATEGY.md
- Usar PrismaService para queries
- Retornar estrutura definida em 04-API-CONTRACTS.md
- Ordem de prioridade: PRODUCT > TAG > CATEGORY (se aplicável)

Referência: Ver exemplo em products.service.ts (Passo 2.7)
```

### Padrão 3: Controller + DTO

```
Crie [ARQUIVO].controller.ts com os endpoints:
- GET /[rota] - listar
- POST /[rota] - criar
- GET /[rota]/:id - detalhe
- PATCH /[rota]/:id - atualizar

Guards: JwtAuthGuard para rotas autenticadas, RolesGuard para ADMIN
DTOs: Validar com class-validator conforme ARCHITECTURE.md

Referência: Ver padrão em auth.controller.ts (Passo 1.11)
```

### Padrão 4: Teste de integração

```
Crie teste E2E que valida fluxo completo:
1. [Ação 1]
2. [Ação 2]
3. [Validação]

Use supertest() para fazer requisições reais contra app rodando
Limpar banco antes/depois com prisma

Referência: Ver padrão em auth.integration.spec.ts (Passo 1.19)
```

---

## Referências cruzadas importantes

Ao pedir para implementar algo, sempre diga:

- **"Conforme ARCHITECTURE.md"** — quando design/estrutura
- **"Conforme TDD-STRATEGY.md"** — quando testes
- **"Conforme DATABASE-SCHEMA.md"** — quando Prisma
- **"Conforme API-CONTRACTS.md"** — quando resposta
- **"Padrão de [arquivo já criado]"** — quando quer copiar estilo

**Exemplo completo:**

```
Crie scales.controller.ts com endpoints GET, POST, PATCH conforme
API-CONTRACTS.md. Use JwtAuthGuard + RolesGuard para admin-only.
Valide DTOs com class-validator conforme ARCHITECTURE.md.
Padrão: veja products.controller.ts (Passo 2.7).
```

---

## Quando rodar testes VS implementar

**Rodar testes manualmente:**
```bash
cd backend
npm run test -- auth.service.spec.ts
```

**Quando pedir ao Claude:**
- "Crie o teste [arquivo] com casos [lista]"
- "Implemente para passar neste teste"
- "Rode: npm run test -- auth.service.spec.ts"

**Quando você faz manualmente:**
- Integração com banco real (supertest)
- Checagem rápida de syntax
- Debug de erro específico

---

## Fluxo de um dia de trabalho

```
1. MANHÃ:
   - Ler qual passo você está (ex: Passo 2.6)
   - Pedir ao Claude: "Implemente Passo 2.6 conforme guia"

2. MEIO DO DIA:
   - Rodar manualmente: npm run test
   - Se falhar, pedir ao Claude para debugar

3. FINAL DO DIA:
   - Commit & push
   - Pedir ao Claude: "Implemente próximo passo"
```

---

## Stack exata para copy-paste nos prompts

Quando pedir contexto de tecnologia:

"Stack: NestJS 11 + Next.js 16.2 + PostgreSQL 18 + Redis + Elasticsearch 9.3 +
Prisma 7 + TypeScript 6 + Node.js 24 + Docker + GitHub Actions.
TDD strict (teste primeiro)."

---

## Leitura de docs no Claude Code

Antes de cada implementação, você pode:

```
"Releia ARCHITECTURE.md para confirmar padrão de [coisa]"
"Veja DATABASE-SCHEMA.md para modelo de [tabela]"
```

Claude lerá o arquivo automaticamente.

---

## Critério de "pronto" para cada passo

Um passo está PRONTO quando:

✓ Teste passa (`npm run test -- arquivo.spec.ts`)
✓ Não quebra testes anteriores (`npm run test -- --coverage`)
✓ TypeScript sem erros (`npx tsc --noEmit`)
✓ Linter passa (`npm run lint`)
✓ CI no GitHub fica verde

Se algum desses falhar, NÃO passe para o próximo passo.

---

## Velocidade máxima

Para ser RÁPIDO no desenvolvimento:

1. **Clone o guia 07-IMPLEMENTATION-GUIDE.md para cada prompt**
   - Copie o passo que quer fazer
   - Cole no prompt para Claude

2. **Use "Refactor em batch"**
   - Não peça para testar cada arquivo
   - Implemente 3-4 arquivos de uma vez
   - Rode teste uma vez no final

3. **Reutilize código**
   - "Padrão como em [arquivo já criado]"
   - Claude copiará estrutura

---

## Exemplo de prompt BALA-DE-PRATA

```
Sou desenvolvedor do e-commerce de miniaturas 3D (NestJS 11 + Next.js 16.2).
Estou no Passo 3.2 — Implemente CartService.

Requisitos do passo (do guia 07-IMPLEMENTATION-GUIDE.md):
- Usar Redis para armazenar carrinho
- Estrutura: userId -> items[] { productId, variationId, quantity }
- Métodos: addItem, removeItem, clear, getCart
- Validações: product existe, variation existe, stock suficiente

Testes DEVE passar em: npm run test -- cart.service.spec.ts
Use padrão de cache-manager conforme ARCHITECTURE.md
DTOs conforme API-CONTRACTS.md

Pronto? Implemente CartService completo.
```

Esse prompt é claro, auto-contido, e acelera a implementação em 10x.

---

**Fim do Guia de Implementação — Boa sorte! 🚀**