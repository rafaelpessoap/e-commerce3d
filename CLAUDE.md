# CLAUDE.md — Memória Persistente do Projeto

> Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão.
> Ele contém o contexto, regras e decisões do projeto para que o Claude mantenha
> consistência entre sessões. ATUALIZE este arquivo sempre que uma decisão
> importante for tomada ou uma convenção for estabelecida.

---

## Identidade do Projeto

- **Nome:** ElitePinup3D
- **Repositório:** https://github.com/rafaelpessoap/e-commerce3d
- **Dono:** Rafael Pessoa (rafaelzezao@gmail.com)
- **Objetivo:** E-commerce de miniaturas 3D (pinups) como piloto. Após validação, migrar arsenalcraft.com.br (12k+ produtos, WooCommerce com 40 plugins).

---

## Stack Tecnológica (FIXA — não sugerir alternativas)

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Runtime | Node.js LTS | 24.x |
| Linguagem | TypeScript | 6.0 |
| Backend | NestJS | 11.x |
| Frontend | Next.js (App Router) | 16.2.x |
| UI | React | 19.2.x |
| Componentes | shadcn/ui + Tailwind CSS | CLI v4 |
| Banco de dados | PostgreSQL | 18 (já instalado no servidor) |
| ORM | Prisma | 6.x |
| Cache | Redis | Já instalado no servidor |
| Busca | Elasticsearch | 9.3 (já instalado no servidor) |
| Fila | BullMQ | 5.71.x |
| Testes backend | Jest + Supertest | Última |
| Testes frontend | Vitest + React Testing Library | Última |
| Testes E2E | Playwright | Última |
| Email | Nodemailer + React Email | SMTP próprio |
| Storage | Cloudflare R2 | S3-compatível |
| CDN | Cloudflare | Já configurado |
| Pagamento | Mercado Pago | API v1 |
| Frete | Melhor Envio | API v2 |
| CI/CD | GitHub Actions | - |
| Container | Docker + Docker Compose | - |

---

## Regra #1: TDD É INEGOCIÁVEL

Este projeto segue Test-Driven Development estrito. O ciclo é:

```
1. ESCREVER o teste PRIMEIRO (deve falhar — RED)
2. IMPLEMENTAR o mínimo para o teste passar (GREEN)
3. REFATORAR mantendo testes verdes (REFACTOR)
```

**NUNCA implemente uma função, endpoint ou componente sem o teste existir antes.**
Se eu pedir "cria o ProductsService", a resposta correta é:
1. Primeiro: criar `products.service.spec.ts` com os casos de teste
2. Rodar `npm run test` e confirmar que FALHAM
3. Depois: criar `products.service.ts` para fazer passar
4. Rodar `npm run test` e confirmar que PASSAM

Referência completa: `docs/02-TDD-STRATEGY.md`

---

## Regra #2: Segurança desde o Dia 1

**NUNCA confie em dados do frontend.** Todo cálculo de preço, desconto, frete e validação de regras é feito exclusivamente no backend.

Regras críticas:
- DTOs usam `whitelist: true` e `forbidNonWhitelisted: true` (campos extras = erro 400)
- Registro de usuário SEMPRE cria role CUSTOMER (campo role NÃO existe no DTO)
- Preços são buscados no banco, NUNCA aceitos do request
- Webhooks do Mercado Pago: verificar assinatura + double-check + idempotência
- OwnershipGuard em TODO recurso que pertence a um usuário (pedidos, endereços, wishlist)
- Upload de imagens: validar extensão + MIME type real + gerar nome aleatório
- Sanitizar HTML em descriptions com DOMPurify
- Senhas com bcrypt (salt rounds 12), NUNCA retornar em responses
- Rate limiting no login (5 tentativas/min)

Referência completa: `docs/08-SECURITY.md`

---

## Regra #3: Convenções de Código

### Nomenclatura
- Arquivos: `kebab-case` (ex: `product-variations.service.ts`)
- Classes: `PascalCase` (ex: `ProductsService`)
- Variáveis/funções: `camelCase` (ex: `calculateBundlePrice`)
- Constantes: `UPPER_SNAKE_CASE` (ex: `MAX_CART_ITEMS`)
- Banco (tabelas): `snake_case` plural (ex: `product_variations`)
- Rotas API: `kebab-case` plural prefixadas com `/api/v1/`
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`)

### Resposta da API
```typescript
// Sucesso
{ data: T }
{ data: T[], meta: { total, page, perPage, lastPage } }

// Erro
{ error: { statusCode, message, details? } }
```

### Branches
- `main` → produção
- `develop` → desenvolvimento
- `feature/*`, `fix/*`, `hotfix/*` → branches de trabalho
- PRs sempre para `develop`, merge para `main` via PR com aprovação

---

## Regra #4: Estrutura do Projeto

```
e-commerce3d/
├── .github/workflows/      # CI/CD
├── docker/                  # Dockerfiles e compose
├── backend/                 # NestJS
│   ├── src/modules/         # Módulos por domínio
│   ├── src/common/          # Guards, interceptors, pipes, decorators
│   ├── src/config/          # Configurações centralizadas
│   ├── prisma/              # Schema, migrations, seed
│   └── test/                # Helpers, fixtures, configs
├── frontend/                # Next.js
│   ├── src/app/             # App Router (páginas)
│   ├── src/components/      # Componentes (ui/, product/, cart/, etc.)
│   ├── src/hooks/           # Custom hooks
│   ├── src/lib/             # Utilitários, API client
│   ├── src/store/           # Zustand stores
│   └── test/                # Testes de componentes e E2E
└── docs/                    # Documentação do projeto
```

Referência completa: `docs/01-SKELETON.md`

---

## Regra #5: Domínio do Negócio — Miniaturas 3D

### Escalas (CONCEITO CRÍTICO)
Miniaturas podem ser vendidas em escalas diferentes (28mm, 32mm, 75mm, etc.).
Cada escala tem uma regra de preço configurável com hierarquia de prioridade:
1. **Produto individual** (maior prioridade)
2. **Tag**
3. **Categoria**
4. **Global** (menor prioridade)

Tipos de modificador: `percentage` (soma %), `fixed_add` (soma valor), `fixed_price` (substitui preço).
Escala NÃO é variação de produto — variações podem ter escalas independentes.

### Bundles / Kits
Kits são compostos por N produtos com desconto.
Preço = soma dos componentes × (1 - desconto).
Preço atualiza automaticamente quando componente muda.
Estoque = menor estoque entre componentes.

### Fluxo de Produção (State Machine)
```
pending_payment → payment_approved → production_queue → producing → packaging → shipped → delivered
```
Extras: payment_rejected, cancelled, refunded.
Cada transição: registra histórico + dispara email personalizado.
Prazo de produção: 3 dias úteis.
Admin pode cadastrar novos status.

### Frete Grátis
Regras configuráveis por faixa de CEP + valor mínimo.
Exemplo: CEPs 01000-000 a 09999-999 → grátis acima de R$150.

### Desconto por Método de Pagamento
Configurável no admin (ex: PIX = 10% de desconto).
Aplicado automaticamente no checkout.

---

## Servidor de Produção

- **Hardware:** AMD Ryzen 5 2600, 32GB DDR4, NVMe 2TB
- **OS:** Ubuntu 24.04 LTS
- **IP:** 24.152.39.104 (SSH porta 2222, usuário masterdaweb)
- **Domínio:** elitepinup3d.com.br (DNS via Cloudflare)
- **Reverse Proxy:** OpenLiteSpeed 1.8.4 via CyberPanel (NÃO usar Nginx)
- **Já rodando:** MariaDB, Redis 7.0.15 (local), Elasticsearch 9.3.2 (local)
- **Containers existentes (NÃO mexer):** arsenal_app (:3001), arsenal_db (PG18), n8n (:5678)
- **Nosso projeto:** elitepinup_backend (:3002), elitepinup_frontend (:3003), elitepinup_db (PG18 interno)
- **Deploy:** GitHub Actions → GHCR (build+push images) → SSH (pull+restart)
- **Storage:** Cloudflare R2 (bucket: elitepinup, CDN: cdn.elitepinup3d.com.br)

---

## Documentação de Referência

Antes de implementar qualquer feature, consulte o documento relevante:

| Documento | Conteúdo |
|-----------|----------|
| `docs/plano-ecommerce-miniaturas.md` | Plano mestre com stack, páginas, features, fases |
| `docs/01-SKELETON.md` | Estrutura de pastas, arquivos, convenções |
| `docs/02-TDD-STRATEGY.md` | Regras de TDD, padrões de teste, checklists por módulo |
| `docs/03-MODULE-SPECS.md` | Endpoints, DTOs, regras de negócio por módulo |
| `docs/04-DOCKER-SPECS.md` | Docker Compose (dev, test, prod), Dockerfiles, Nginx |
| `docs/05-CICD-SPECS.md` | GitHub Actions: CI, security, deploy |
| `docs/06-PRISMA-SCHEMA.md` | Schema do banco completo, índices, seed data |
| `docs/07-IMPLEMENTATION-GUIDE.md` | Passo-a-passo de implementação por fase |
| `docs/08-SECURITY.md` | Regras de segurança, testes de segurança, checklists |

---

## Progresso Atual

### Fase 0 — Setup do Projeto ✅
- [x] Criar estrutura de pastas
- [x] Configurar Docker Compose (dev, test, prod)
- [x] Inicializar NestJS 11 com TypeScript strict
- [x] Inicializar Next.js 16.2 com App Router + shadcn/ui
- [x] Criar Prisma schema inicial (todos os models)
- [x] Configurar Jest (backend), Vitest + Playwright (frontend)
- [x] Configurar GitHub Actions CI
- [x] Primeiro teste passando — health check TDD (RED → GREEN)

### Fase 1 — Autenticação ✅
- [x] PrismaModule/PrismaService (global, @prisma/client)
- [x] Prisma schema estendido (User com auth fields, RefreshToken model)
- [x] Auth module — register (TDD: 4 testes, bcrypt salt 12, role CUSTOMER forçado)
- [x] Auth module — login (TDD: 6 testes, mensagem genérica, isActive check, lastLoginAt)
- [x] Auth module — refreshToken (TDD: 5 testes, rotação de tokens, revogação)
- [x] Auth controller (register, login, refresh) com DTOs validados
- [x] JWT Strategy (passport-jwt, access 7d, refresh 30d)
- [x] Guards globais (JwtAuthGuard com @Public, RolesGuard com @Roles)
- [x] Decorators (@Public, @Roles, @CurrentUser)
- [x] Users module — getProfile, updateProfile, changePassword (TDD: 9 testes)
- [x] ValidationPipe global (whitelist + forbidNonWhitelisted + transform)
- [x] Addresses module — CRUD completo (TDD: 17 testes, ownership check, isDefault toggle, cannot delete last)

### Fase 2 — Catálogo ✅
- [x] Prisma schema atualizado (isActive, image, color, featured, content, isMain nos models)
- [x] Categories module — CRUD hierárquico com auto-slug, parentId, soft delete (TDD: 7 testes)
- [x] Tags module — CRUD com auto-slug e color (TDD: 3 testes)
- [x] Brands module — CRUD com auto-slug (TDD: 4 testes)
- [x] Scales module — CRUD + calculatePrice com hierarquia PRODUCT > CATEGORY > GLOBAL (TDD: 6 testes)
- [x] Products module — CRUD com auto-slug, paginação, filtros, soft delete (TDD: 8 testes)
- [x] Todos os controllers com @Public (listagem) e @Roles('ADMIN') (escrita)
- [x] Elasticsearch — SearchService (index, remove, bulk, search com filtros + fuzzy), SearchIndexer (sync DB→ES, reindexAll) (TDD: 12 testes)
- [x] Media module — upload S3/R2, validateFile (MIME + ext + size), generateKey (UUID), delete (TDD: 12 testes)

### Fase 3 — Checkout ✅
- [x] Prisma schema: Coupon, CouponUsage, FreeShippingRule, OrderStatusHistory, Bundle, BundleItem, Payment
- [x] Coupons module — CRUD + validate: 10 regras (active, expired, minValue, maxUses, perUser, firstPurchase) (TDD: 11 testes)
- [x] Cart module — Redis cache, addItem, removeItem, updateQuantity, clear, product validation (TDD: 8 testes)
- [x] Orders module — createOrder (orderNumber gerado), updateStatus (state machine), findAll paginado (TDD: 13 testes)
- [x] Shipping module — FreeShippingRules CRUD, checkFreeShipping (zipCode range + minValue) (TDD: 6 testes)
- [x] Payments module — createPayment (desconto PIX 10%, boleto 5%), processWebhook (idempotente) (TDD: 8 testes)
- [x] Bundles module — CRUD, calculateBundlePrice = soma × (1 - desconto), findBySlug com preço calculado (TDD: 5 testes)
- [x] Emails transacionais — EmailService com Nodemailer + React Email templates + BullMQ queue (TDD: 38 testes email)

### Fase 4 — Pós-venda ✅
- [x] Wishlist module — add, remove, findAll com deduplicação (TDD: 4 testes)
- [x] Email module — React Email templates + BullMQ fila assíncrona (TDD: 38 testes)
- [x] Minha Conta: Users/Addresses/Orders — implementados nas fases anteriores

### Fase 5 — Admin ✅
- [x] Admin Dashboard — getDashboardStats, getOrdersByStatus (TDD: 2 testes)
- [x] CRUD completo: Products, Categories, Tags, Brands, Scales, Coupons, FreeShippingRules, Bundles — @Roles('ADMIN')
- [x] Gestão de pedidos: updateStatus com state machine + histórico

### Frontend Next.js ✅
- [x] Infra: API client (axios + sessionId), types, React Query, Zustand (auth, cart)
- [x] URLs curtas: `/p/slug`, `/c/slug`, `/m/slug`, `/t/slug`
- [x] Carrinho anônimo (sessionId no localStorage, merge no login)
- [x] Wishlist button nos ProductCards (coração, redirect se não logado, auto-add após login)
- [x] Checkout com endereço completo (ViaCEP auto-fill)
- [x] Proteção de rotas: /admin (login+ADMIN), /minha-conta (login), returnTo após login
- [x] Cloudflare cache rules: /_next/static (365d), /_next/image (30d), /api (bypass)
- [x] Seed: 5 categorias, 4 escalas, 5 tags, 2 marcas, cupom WELCOME10, produto exemplo
- [x] Páginas: Home, produtos, `/p/`, `/c/`, `/m/`, `/t/`, busca, blog, carrinho, checkout, confirmação, rastreamento, login, cadastro, recuperar-senha, sobre, contato, FAQ, termos, privacidade, trocas
- [x] Admin: dashboard, produtos, pedidos, categorias, tags, marcas, escalas, frete, cupons, blog, config
- [x] Minha Conta: dashboard, pedidos (lista+detalhe+timeline), dados, endereços, wishlist

### Fase 6 — SEO, Performance e Infra ✅
- [x] SEO module — upsertMeta por entidade, getMeta, generateSitemap (TDD: 5 testes)
- [x] Blog module — CRUD posts com auto-slug, publish/unpublish, paginação (TDD: 7 testes)
- [x] Frontend: /blog, /blog/[slug], /admin/blog
- [x] Docker prod: multi-stage Dockerfiles, docker-compose.prod.yml (GHCR images, sem nginx)
- [x] OLS vhost: proxy para backend:3002 e frontend:3003, SSL, config protegida com chattr +i
- [x] GitHub Actions: CI (lint+test+build) + Security (CodeQL+audit) + Deploy (GHCR build+push, SSH pull)
- [x] Dependabot: npm weekly, Docker monthly, Actions weekly
- [x] Branch protection: main requer CI verde
- [x] RedisModule: ioredis wrapper reutilizável (15 testes), CartService refatorado
- [ ] Cache por rota (Redis + Cloudflare) — pós-deploy, baseado em métricas
- [ ] Testes de carga (k6/Artillery) — pós-deploy

### Deploy em Produção ✅ (03/04/2026)
- [x] Servidor configurado: /opt/elitepinup/.env + docker-compose.yml
- [x] OLS vhost com proxy reverso + SSL + HTTPS redirect + chattr +i
- [x] Containers: elitepinup_db (healthy), elitepinup_backend (healthy), elitepinup_frontend (healthy)
- [x] Site no ar: https://elitepinup3d.com.br (API + Frontend)
- [x] Admin: rafaelzezao@gmail.com / Admin@2026!
- [x] Deploy automático: push → GHCR build → SSH pull+restart
- [x] R2 testado, Redis configurado (bind 0.0.0.0, senha, firewall)
- [x] Seed executado: 5 categorias, 4 escalas, 5 tags, 2 marcas, cupom WELCOME10, produto exemplo
- [x] Cloudflare cache rules configuradas via API
- [x] Teste manual: registro, login, carrinho, checkout com endereço ViaCEP, pedido finalizado ✅

---

## Pendências — Sistema de Produtos Completo (estilo WooCommerce)

Plano detalhado em: `~/.claude/plans/memoized-riding-platypus.md`

### Sprint 1 — Schema + Atributos + Admin Produto ✅ (03/04/2026)
- [x] Prisma schema: +salePrice, shortDescription, weight, dimensions, gtin, extraDays, manageStock, type em Product. +image, gtin, salePrice, dimensions em ProductVariation. +extraDays em Category/Tag
- [x] Prisma schema: novos models Attribute, AttributeValue, ProductAttribute, RelatedProduct, Review, ReviewReward
- [x] Backend: Attributes CRUD (TDD: 7 testes) — create auto-slug, findAll com values, createValue, deleteValue
- [x] Backend: Product DTOs completos (CreateProductDto + UpdateProductDto com todos os campos)
- [x] Backend: ProductsService atualizado — create/update com tags+atributos, findById, resolveExtraDays (TDD: 14 testes)
- [x] Frontend: `/admin/atributos` — gerenciar atributos e valores (cards com badges, criar/deletar inline)
- [x] Frontend: `/admin/produtos/[id]` — página de edição (era 404, agora funciona)
- [x] Frontend: `ProductForm` com 3 abas (Geral, Categorização, Inventário)
- [x] Aba Geral: nome, slug editável (/p/slug), descrição curta, descrição longa, HTML content, preço + promo, SKU + GTIN, tipo, status, destaque, dias adicionais
- [x] Aba Categorização: categoria/marca (select + criar inline), tags (multi-select + criar inline)
- [x] Aba Inventário: toggle gerenciar estoque, quantidade, peso, dimensões
- [x] Total: 35 test suites, 231 testes passando, 37 rotas frontend

### Sprint 2 — Imagens + Variações + Editor Rich Text + Atributos ✅ (03/04/2026)
- [x] RichTextEditor (TipTap): toolbar (bold, italic, headings, lists, link, image), toggle HTML mode
- [x] ImageUpload: upload para R2, imagem principal (star), galeria grid, remover
- [x] VariationEditor: CRUD inline (escala, preço, promo, SKU, GTIN, estoque, imagem URL)
- [x] AttributeSelector: multi-select valores por atributo, criar atributo/valor inline
- [x] ProductForm agora tem 6 abas: Geral, Imagens, Categorização, Inventário, Atributos, Variações (se variável)
- [x] Total: 35 test suites, 231 testes, 37 rotas frontend

### Sprint 2.5 — Galeria de Mídia Centralizada + Pipeline de Imagens ✅ (03/04/2026)

**Backend (TDD RED→GREEN: 7 novos testes, 11 total no media):**
- [x] Schema: model MediaFile (filename, mimeType, size, thumb/card/gallery/full WebP URLs, alt/title/description SEO, width/height)
- [x] Schema: ProductImage atualizado (mediaFileId FK para MediaFile)
- [x] TDD RED: 7 testes escritos PRIMEIRO, confirmados RED (falhando)
- [x] TDD GREEN: processAndUpload (Sharp → WebP 4 tamanhos → R2 paralelo → DB), deleteMediaFile, updateMediaMeta, findAllMedia
- [x] Controller: POST upload, GET listar (paginado+busca), GET /:id, PUT /:id (SEO), DELETE /:id

**Frontend:**
- [x] `/admin/galeria`: grid de imagens, busca, modal de detalhes (preview, editar alt/title/description, info, deletar)
- [x] ImageUpload atualizado: dois modos "Upload novo" + "Escolher da galeria" (modal picker)
- [x] Cada imagem mostra: card preview + alt + marcar principal + remover
- [x] Total: 35 test suites, 230 testes, 38 rotas frontend

**Passo 7 — Usar variantes corretas no site público:**
- [ ] ProductCard: `mediaFile.card` (400px)
- [ ] Página produto: gallery (800px), thumb (150px), full (1600px zoom)

**Passo 8 — Validação + CLAUDE.md:**
- [ ] TypeScript OK, testes passando, build OK
- [ ] Atualizar CLAUDE.md com checkboxes marcados
- [ ] Commit + push + deploy

### Sprint 3 — Entrega + Relacionados + Página pública completa ✅ (03/04/2026)
- [x] Backend: resolveExtraDays(productId) — prioridade: produto > tag > categoria (Sprint 1)
- [x] Frontend: aba Entrega no ProductForm — dias adicionais com preview prazo
- [x] Frontend: aba Relacionados no ProductForm — placeholder (auto por categoria)
- [x] Frontend: ProductForm agora tem 8 abas (Geral, Imagens, Categorização, Inventário, Atributos, Variações, Entrega, Relacionados)
- [x] Frontend: `/p/[slug]` reescrita completa:
  - [x] ProductGallery: imagem principal + thumbnails clicáveis (suporta MediaFile e legacy)
  - [x] Preço promocional riscado + preço atual + PIX 10% off
  - [x] Atributos do produto em tabela (nome: valor)
  - [x] Variações com preço por escala
  - [x] Prazo de entrega (via /products/:id/delivery-info)
  - [x] Produtos relacionados (mesma categoria, exclui o próprio)
  - [x] Wishlist button na página
  - [x] Tags como links para /t/slug
  - [x] Categoria e marca como links
- [x] Tipos Product atualizados (shortDescription, salePrice, gtin, type, attributes, etc.)
- [x] ProductCard atualizado para suportar MediaFile.card
- [x] Total: 35 test suites, 230 testes, 38 rotas frontend

### Sprint 4 — Avaliações + Filtros por Atributos ✅ (03/04/2026)

**Backend (TDD RED→GREEN):**
- [x] ReviewsService: create (valida DELIVERED + ownership + product in order + rating 1-5), findByProduct (só approved), getAverageRating, approve, generateReward (cupom 5%) — TDD: 10 testes
- [x] ReviewsController: POST /reviews, GET /products/:id/reviews, GET /reviews/admin, PUT /reviews/:id/approve
- [x] ProductsService.findAll: filtro por attributeValueIds + priceMin/priceMax — TDD: 1 teste novo (15 total)
- [x] ProductsController: query params attributes (comma-separated), priceMin, priceMax

**Frontend:**
- [x] StarRating: componente de estrelas (display + interactive mode)
- [x] ReviewsSection: média + lista de reviews aprovadas na página do produto
- [x] ReviewButton: botão "Avaliar" em pedidos DELIVERED, modal com estrelas + comentário
- [x] FilterSidebar: sidebar com filtros por atributos (checkboxes), marca (radio), preço (min/max)
- [x] /produtos: layout com sidebar + grid filtrado
- [x] Total: 36 test suites, 241 testes, 38 rotas frontend

### Email Templates + Fila Assíncrona ✅ (03/04/2026)
- [x] React Email: 5 templates profissionais (welcome, order-confirmation, status-change, password-reset, review-reward)
- [x] Layout compartilhado com branding ElitePinup3D (header dourado, footer)
- [x] EmailQueueService: fila BullMQ com retry (3 tentativas, backoff exponencial), concorrência 5
- [x] Worker BullMQ: processa jobs assincronamente (completed/failed logging)
- [x] AuthService atualizado para usar fila (enqueuePasswordReset em vez de chamada direta)
- [x] TDD: 20 testes templates + 7 testes EmailService + 11 testes EmailQueueService = 38 testes email
- [x] Jest config: --experimental-vm-modules (React Email render), moduleNameMapper para slug ESM

### Sistema de Email Templates Editáveis ✅ (03/04/2026)
- [x] Prisma model: EmailTemplate (type unique, subject, htmlBody, availableTags JSON, isActive)
- [x] EmailTemplateService: findAll, findByType, update, renderTemplate com sistema de tags {{tag}} (TDD: 9 testes)
- [x] Segurança: escape HTML nos valores das tags (previne XSS), tags HTML confiáveis (itens_pedido, rastreio_secao) não escapadas
- [x] EmailService integrado: busca template do DB → renderiza tags → envia. Fallback para React Email se template não existir
- [x] EmailTemplateController: GET /email-templates, GET /:id, PUT /:id — @Roles('ADMIN')
- [x] Seed: 5 templates padrão com layout profissional e tags em português
- [x] Frontend: /admin/emails — lista templates, editor HTML, preview iframe ao vivo, sidebar de tags com copy/insert
- [x] Inserir imagens da galeria de mídia no corpo do email
- [x] Tags disponíveis: {{nome_cliente}}, {{email_cliente}}, {{numero_pedido}}, {{itens_pedido}}, {{subtotal}}, {{frete}}, {{desconto}}, {{total}}, {{metodo_pagamento}}, {{status_label}}, {{status_descricao}}, {{rastreio_secao}}, {{codigo_rastreio}}, {{url_redefinicao}}, {{nome_produto}}, {{codigo_cupom}}, {{percentual_desconto}}, {{url_loja}}
- [x] Total: 39 test suites, 285 testes passando, TypeScript OK, frontend build OK, 39 rotas

### Integração Melhor Envio ✅ (03/04/2026)
- [x] Prisma models: ShippingMethod (serviceId, name, displayName editável, company, extraDays por método, isActive), Setting (key-value para CEP origem)
- [x] MelhorEnvioService: getQuotes (API Melhor Envio), getAvailableServices (lista completa), toggleMethod (habilitar/desabilitar), getEnabledMethods (TDD: 8 testes)
- [x] Cotação real: POST /shipping/quote — recebe CEP + produtos, busca peso/dimensões do DB, resolve extraDays (MAX entre produtos), cota no Melhor Envio, filtra serviços habilitados, soma extraDays do método + dos produtos
- [x] Frete grátis: verifica regras de frete grátis antes de retornar cotações, exibe preço riscado + "Grátis"
- [x] Checkout reescrito: card de "Opções de Frete" obrigatório (selecionar antes de confirmar), frete somado ao total, desconto (PIX/Boleto) NUNCA se aplica ao frete
- [x] ShippingCalculator: componente reutilizável — digita CEP → mostra opções com preço, prazo e transportadora
- [x] Admin /admin/frete reescrito: (1) CEP de origem editável, (2) toggle de serviços do Melhor Envio com nome de exibição e dias extras por método, (3) regras de frete grátis
- [x] OrderDTO atualizado: campos shipping (obrigatório), shippingServiceName no pedido
- [x] Total: 40 test suites, 293 testes passando, TypeScript OK, frontend build OK

### Integrações Externas
- [x] Melhor Envio — integração completa (cotação, serviços habilitáveis, CEP de origem, dias extras por método)
- [x] SMTP — mail.cyberpersons.com:587, testado e funcionando
- [ ] Mercado Pago — ACCESS_TOKEN + WEBHOOK_SECRET (adiado por decisão do Rafael)

### Admin CRUD Completo ✅ (03/04/2026)
- [x] Todas as páginas admin mostram erros ao usuário (antes falhavam silenciosamente)
- [x] Categorias: edição inline (click no nome), exclusão com confirmação
- [x] Tags: edição inline (nome + cor), exclusão
- [x] Marcas: edição inline (nome), exclusão
- [x] Escalas: edição inline (todos os campos), exclusão (+ novos endpoints PUT/DELETE no backend)
- [x] Cupons: CRUD completo reescrito — formulário de criação, dialog de edição, exclusão (antes só tinha listagem)
- [x] Atributos: já tinha criar/deletar valores, agora com error handling
- [x] Galeria: mensagem de erro no upload, refresh automático após upload (refetchQueries)

### Deploy Produção Atualizado ✅ (03/04/2026)
- [x] Schema completo aplicado em produção (prisma db push — todas as tabelas novas)
- [x] Containers recriados com imagens mais recentes
- [x] Seed de email templates executado em produção
- [x] next.config.ts corrigido: cdn.elitepinup3d.com.br (era cdn.miniatures3d.com)
- [x] Sessão persistente: atualizar página não desloga mais (hydrate via GET /users/me)
- [x] CI verde (lint errors corrigidos: unused imports, unescaped entities, explicit any)

### ProductForm WooCommerce + Deploy Fix ✅ (03-04/04/2026)
- [x] ProductForm reescrito estilo WooCommerce: 2 colunas (main + sidebar sticky), blocos modulares
- [x] Sidebar: Publicar (status/tipo/salvar), Imagens, Categoria, Marca, Tags com inline create
- [x] Main: Nome+slug, Descrição Completa (RichTextEditor), Dados do Produto (abas verticais), Descrição Curta
- [x] Abas verticais (Inventário, Produção, Atributos, Variações) — todas renderizadas simultaneamente (CSS toggle, sem perda de dados)
- [x] Após salvar: mensagem de sucesso, NÃO redireciona. Botão "Cadastrar novo" + "Ver na lista"
- [x] Fontes maiores (text-base wrapper, text-lg inputs)
- [x] Produto variável: preço do pai desabilitado, preços apenas nas variações
- [x] Variações: imagem via upload/galeria (era URL), nome auto do atributo, peso/dimensões herdam do pai
- [x] Link do produto abaixo do slug: "Ver produto: /p/slug" (abre em nova aba)
- [x] Product DTOs: @IsUUID → @IsString (IDs são CUIDs), basePrice aceita 0 para variáveis, description sem @MinLength
- [x] ProductImage → MediaFile FK: onDelete Cascade (era RESTRICT, causava erro binário)
- [x] Deploy workflow: testes antes do build, --force-recreate (containers não atualizavam), versionamento automático YYYYMMDD-SHA
- [x] GitHub Releases automáticas em cada deploy
- [x] Versão visível no rodapé da sidebar admin (NEXT_PUBLIC_APP_VERSION)
- [x] Docker actions: login-action v4, build-push-action v7 (Node.js 24)
- [x] Pacotes não usados removidos: cache-manager-redis-yet, cache-manager, @nestjs/cache-manager
- [x] OLS cache: noCacheUrl para /admin, /api, /login, /minha-conta, /checkout (evita cache de binário)
- [x] Atributos: refetchQueries para atualização imediata, form fica aberto após adicionar valor
- [x] Total: 40 test suites, 293 testes passando, 0 lint errors

### Admin UX Overhaul + Clientes + Cupons Avançados ✅ (04/04/2026)

**Backend (TDD: 300 testes passando):**
- [x] Schema: User +cpf (unique) +phone, Coupon +categoryId +tagId +userId
- [x] UsersService.findAll: paginado com busca por nome/email/cpf (TDD: 3 testes novos)
- [x] UsersController: GET /users (@Roles ADMIN) com paginação e search
- [x] CouponsService: validação por userId exclusivo, retorna categoryId/tagId no resultado (TDD: 4 testes novos)
- [x] Coupons findAll inclui relations category/tag/user, update aceita todos os campos
- [x] Tags/Categories DTOs: extraDays em create e update
- [x] MelhorEnvio: syncServicesFromApi() — cotação fictícia para descobrir serviços disponíveis, upsert no DB
- [x] Settings endpoint genérico: GET retorna todos, PUT aceita qualquer key-value
- [x] Schema aplicado em produção (prisma db push)

**Frontend:**
- [x] /admin/clientes: tabela paginada (nome, email, CPF, telefone, pedidos, cadastro), busca, dialog detalhes
- [x] /admin/galeria: reescrita como lista (thumb+info+ações), editar inline, ampliar em modal, excluir
- [x] /admin/tags: campo "Dias de produção" no criar/editar/tabela
- [x] /admin/categorias: campo "Dias de produção" no criar/editar/tabela
- [x] /admin/cupons: restrições por categoria (select), tag (select), cliente exclusivo (busca por email)
- [x] /admin/configuracoes: cards editáveis (nome loja, email, desconto PIX/Boleto %, prazo produção)
- [x] /admin/frete: botão "Sincronizar Transportadoras" (POST /methods/sync)
- [x] Checkout: seção "Dados Pessoais" (nome, CPF com máscara, telefone com máscara, email read-only)
- [x] Checkout: salva cpf/phone no perfil do user após pedido
- [x] Total: 40 test suites, 300 testes passando, 0 lint errors

### Bugfixes Sessão 04/04/2026 (tarde) ✅
- [x] Sidebar admin: h-screen sticky + overflow-y-auto nav + footer fixo
- [x] Galeria zoom: full image (1600px) + max-h-[80vh] + sem aspect ratio fixo
- [x] Email templates: controller { data } wrapper + error handling + safe JSON.parse
- [x] Escalas: controller { data } wrapper (data.data retornava vazio)
- [x] Shipping sync: fallback hardcoded sem token, log detalhado, CEP do banco
- [x] Clientes: adminUpdateUser + adminGetUserAddresses (TDD: 4 testes, 13 total), frontend edit+endereços
- [x] Total: 40 test suites, 304 testes passando, 0 lint errors

### Pendências — Próxima Sessão

#### Bugs encontrados pelo Rafael (prioridade alta) — TODOS RESOLVIDOS ✅ (04/04/2026):
- [x] Botão "Sincronizar Transportadoras": fallback para serviços hardcoded sem token, error logging detalhado
- [x] /admin/clientes: PUT /users/:id (admin edit) + GET /users/:id/addresses (TDD: 4 testes novos, 13 total)
- [x] /admin/clientes: dialog com endereços do cliente + formulário de edição (nome, CPF, telefone, ativo)
- [x] /admin/galeria: zoom usa imagem full (1600px) com max-h-[80vh], sem aspect ratio fixo
- [x] /admin/emails: controller wraps { data }, error handling, safe JSON.parse
- [x] /admin/escalas: controller findAll/create/update agora retorna { data } (frontend fazia data.data)
- [x] Sidebar admin: h-screen sticky top-0, nav overflow-y-auto, footer flex-shrink-0

#### Melhorias na página pública do produto /p/[slug] ✅ (04/04/2026):
- [x] ProductShipping: calculadora de frete na página do produto (CEP → cotações com preço/prazo)
- [x] Descrição curta movida para logo abaixo do nome (antes do preço)
- [x] Descrição longa + content HTML movidos para seção full-width abaixo da imagem
- [x] AdminEditButton: botão "Editar produto" visível só para ADMIN (link para /admin/produtos/[id])

#### Outras Pendências:
- [ ] Blog admin: criar/editar posts (TipTap)
- [ ] Cache Redis por rota (CacheInterceptor)
- [ ] Testes de carga (k6/Artillery)
- [ ] Cloudflare Origin Certificate (15 anos)
- [ ] Mercado Pago integration (adiado)

---

## Decisões Tomadas (Log)

| Data | Decisão | Contexto |
|------|---------|----------|
| 2026-04-02 | NestJS (não Go/Rust) | Operações são I/O bound, ecossistema TS é superior para e-commerce |
| 2026-04-02 | PostgreSQL (não MariaDB) | JSONB, query planner, já instalado no servidor |
| 2026-04-02 | Docker mantido | Overhead 1-3% irrelevante, benefícios de isolamento e deploy |
| 2026-04-02 | shadcn/ui + Tailwind | Controle total do código, Radix UI, boa integração com Claude |
| 2026-04-02 | SMTP próprio (não SES) | Rafael já tem SMTP configurado |
| 2026-04-02 | Cloudflare R2 | Sem custo de egress, integra com Cloudflare CDN |
| 2026-04-02 | Sem Go por enquanto | Reavaliar após migração do Arsenal Craft se houver gargalo |
| 2026-04-02 | Segurança integrada ao TDD | Não é fase separada, cada módulo tem testes de segurança |
| 2026-04-02 | Node.js 22 (não 24) | v24 não disponível na máquina, v22 é LTS compatível |
| 2026-04-03 | Prisma 6 (não 7) | Prisma 7 prisma-client-js não aceita URL no constructor nem no schema (com prisma.config.ts). Incompatível com deploy Docker. Prisma 6 funciona igual ao ERP |
| 2026-04-02 | Elasticsearch 8.17 (não 9.3) | ES 9.3 não existe ainda no Docker Hub, usando 8.17 (última estável) |
| 2026-04-02 | bcrypt salt rounds = 12 | Recomendação do doc de segurança para 2026+, mais seguro que 10 |
| 2026-04-03 | Access token 7d, refresh 30d | Sessão curta (15min) fazia cliente deslogar constantemente. 7d/30d é mais prático para e-commerce |
| 2026-04-03 | OLS (não Nginx) como proxy | Servidor usa CyberPanel/OLS. Nginx no Docker seria redundante e conflitaria |
| 2026-04-03 | Portas 3002/3003 (não 4000/3000) | 3000 ocupada por nghttpx, 3001 pelo ERP. Backend:3002, Frontend:3003 |
| 2026-04-03 | Redis/ES no host (não containers) | Redis 7.0.15 e ES 9.3.2 já rodam no host. Containers acessam via extra_hosts host.docker.internal |
| 2026-04-03 | GHCR (não build local) | Imagens Docker buildadas no GitHub Actions e pushadas para ghcr.io. Servidor só faz pull |
| 2026-04-03 | chattr +i no vhost.conf | CyberPanel esvazia vhost.conf em cada restart do OLS. chattr +i protege contra overwrite |
| 2026-04-03 | Cloudflare R2 bucket: elitepinup | CDN: cdn.elitepinup3d.com.br. Token S3 API testado e funcionando |
| 2026-04-03 | URLs curtas /p/ /c/ /m/ /t/ | Produto, categoria, marca, tag. /produtos para listagem geral. SEO-friendly e curtas |
| 2026-04-03 | Carrinho anônimo via sessionId | UUID no localStorage, header x-session-id, merge no login via POST /cart/merge |
| 2026-04-03 | Cloudflare cache rules via API | /_next/static 365d, /_next/image 30d, /api bypass. Configurado via API com Zone ID |
| 2026-04-03 | Redis bind 0.0.0.0 + senha | Redis local precisou abrir bind para Docker bridge (172.x). Senha: EliteRedis2026!. nft firewall rule para 172.16.0.0/12 |
| 2026-04-03 | Redirect HTTP→HTTPS via OLS rewrite | RewriteCond %{HTTPS} !on → 301 para https |
| 2026-04-03 | Admin produto estilo WooCommerce | Sistema completo com atributos, variações, galeria, inventário, relacionados, avaliações. Plano em 4 sprints |
| 2026-04-03 | SEO pega de outros campos | Meta title = nome do produto, meta description = descrição curta. Sem campos SEO separados |
| 2026-04-03 | Dias adicionais de entrega | Prioridade: produto > tag > categoria. Campo extraDays em cada nível |
| 2026-04-03 | Atributos como modelo separado | Attribute → AttributeValue → ProductAttribute. Reutilizáveis para filtros na listagem |
| 2026-04-03 | Avaliações com recompensa | Só pode avaliar produto de pedido DELIVERED. Cupom de desconto gerado como recompensa |
| 2026-04-03 | Pipeline de imagens local (Sharp) | Converter para WebP + 4 tamanhos (thumb 150px, card 400px, gallery 800px, full 1600px). Processamento local no servidor (32GB RAM). Não usar serviços externos |
| 2026-04-03 | Galeria de mídia centralizada (MediaFile) | Imagens são entidades independentes com SEO (alt, title, description). Reutilizáveis em produtos, blog, variações. Uma imagem pode estar em vários produtos |
| 2026-04-03 | 4 variantes de tamanho por imagem | thumb (150px, q75), card (400px, q80), gallery (800px, q85), full (1600px, q90). Não amplia se original menor. Tudo WebP |
| 2026-04-02 | React Email para templates | Templates como componentes React renderizados no servidor. Mais manuteníveis que HTML inline. 5 templates: welcome, order-confirmation, status-change, password-reset, review-reward |
| 2026-04-02 | BullMQ para fila de emails | Emails enviados assincronamente via fila Redis. 3 tentativas com backoff exponencial. Worker com concorrência 5. Evita timeout em requests |
| 2026-04-02 | Jest --experimental-vm-modules | React Email render v2 usa dynamic import que requer essa flag. slug ESM resolvido com moduleNameMapper para mock CJS |
| 2026-04-03 | Email templates editáveis no admin | Templates HTML no banco (EmailTemplate model) com sistema de tags {{tag}}. Admin edita subject + body + preview. React Email como fallback se template não existir no DB. Imagens da galeria inseríveis no corpo |
| 2026-04-03 | Melhor Envio integração completa | Cotação real via API /me/shipment/calculate. Admin habilita/desabilita serviços, edita nome de exibição e dias extras por método. CEP de origem editável no admin. Frete obrigatório no checkout. Desconto NUNCA se aplica ao frete |
| 2026-04-03 | Model Setting (key-value) | Configurações editáveis no admin (ex: shop_cep). Simples key-value no banco, sem model separado por config |
| 2026-04-03 | ExtraDays lógica de frete | MAX entre todos os produtos do pedido (produto > tag > categoria) + dias extras do método de envio. Tudo somado ao prazo do Melhor Envio |
| 2026-04-03 | Auth hydrate no app init | Zustand auth store chama GET /users/me ao carregar se accessToken existe no localStorage. Layouts protegidos esperam isHydrated antes de redirecionar |
| 2026-04-03 | Error handling obrigatório em mutations | Todas as páginas admin devem ter onError com extractError helper + div de erro visível. Falhas silenciosas confundem o usuário |
| 2026-04-03 | Admin CRUD inline edit | Padrão: click no nome da linha → campos editáveis inline. Enter salva, Escape cancela. Botão delete com confirm(). Sem página separada de edição para entidades simples |
| 2026-04-03 | Cupons CRUD completo | Formulário de criação com todos os campos (code, type, value, minOrder, maxUses, usesPerUser, validade, firstPurchase). Dialog de edição. Delete com confirmação |
| 2026-04-03 | Scales PUT/DELETE endpoints | Escalas não tinham endpoints de update/delete no backend. Criados com UpdateScaleDto (campos opcionais) + soft delete (isActive: false) |
| 2026-04-03 | ProductForm WooCommerce layout | 2 colunas: main (nome, descrições, dados com abas verticais) + sidebar sticky (publicar, imagens, categorias, marca, tags). Blocos modulares como WooCommerce |
| 2026-04-03 | Abas verticais com CSS toggle | Todas as abas renderizadas simultaneamente, toggle via CSS hidden/block. Evita perda de dados entre abas |
| 2026-04-03 | Produto variável sem preço pai | Quando tipo=variable, preço base é desabilitado. Cada variação define seu próprio preço. basePrice aceita 0 |
| 2026-04-03 | Variações baseadas em atributos | WooCommerce-style: seleciona atributo → marca valores → gera variações. Cada variação tem preço, SKU, estoque, peso/dimensões (herda do pai), imagem (upload/galeria) |
| 2026-04-03 | Deploy --force-recreate | docker compose up -d sem --force-recreate não recriava containers mesmo com imagem nova. Agora deploy sempre força recreate |
| 2026-04-03 | Versionamento automático | YYYYMMDD-SHA7 (ex: 20260403-f6e56ea). Exibido no rodapé admin. GitHub Release criada automaticamente em cada deploy |
| 2026-04-04 | OLS noCacheUrl para admin | LiteSpeed cache cacheava rotas do admin causando binário corrompido. Adicionado noCacheUrl para /admin, /api, /login, /minha-conta, /checkout |
| 2026-04-04 | Cupons com regras por categoria/tag/cliente | Cupom pode restringir desconto a uma categoria ou tag específica. Cupom exclusivo para um cliente. Desconto aplicado apenas nos items que encaixam |
| 2026-04-04 | User precisa de CPF e telefone | Dados obrigatórios para e-commerce brasileiro. CPF com validação, telefone com máscara. Coletados no checkout e editáveis no perfil |
| 2026-04-04 | Galeria em lista (não grid) | Cada imagem como linha: thumb 60x60 + info + ações (ampliar, editar, excluir). Mais prático para gerenciar metadados SEO |
| 2026-04-04 | Tags/Categories extraDays no frontend | Campo "Dias de produção" editável na criação e edição de tags e categorias. Completa a hierarquia produto > tag > categoria |
| 2026-04-04 | Settings genérico key-value | Endpoint GET/PUT /shipping/settings agora aceita qualquer chave. Usado para: shop_cep, store_name, contact_email, pix_discount, boleto_discount, base_production_days |
| 2026-04-04 | Cupons com restrições de categoria/tag/cliente | Cada cupom pode ter categoryId (desconto só nessa categoria), tagId (só nessa tag), userId (exclusivo para um cliente). Validação no backend impede uso por outro user |
| 2026-04-04 | Melhor Envio sync via cotação fictícia | Para descobrir serviços disponíveis, faz cotação com dados dummy e extrai os serviços retornados. Upsert no banco sem alterar isActive de existentes |
| 2026-04-04 | Checkout coleta dados pessoais | Nome, CPF (máscara 000.000.000-00), telefone (máscara (00) 00000-0000) obrigatórios. Email read-only do perfil. Após pedido, salva cpf/phone no perfil do user |
| 2026-04-04 | Controllers devem wrappear em { data } | Todos os controllers devem retornar { data: result } para consistência. Frontend faz data.data. Sem wrapper, data.data era undefined → listas vazias |
| 2026-04-04 | Admin rotas :id DEPOIS de /me | NestJS match por ordem de declaração. Se PUT :id vem antes de PUT me, 'me' casa como :id. Rotas estáticas (/me, /me/password) devem ser declaradas primeiro |
| 2026-04-04 | Sidebar admin deve ser sticky | Sidebar cresce com conteúdo se não tiver h-screen. Solução: h-screen sticky top-0 + overflow-y-auto na nav + flex-shrink-0 no header/footer |
| 2026-04-04 | Shipping sync fallback sem token | MELHOR_ENVIO_TOKEN pode estar vazio. Em vez de falhar, sync faz fallback para lista hardcoded de serviços e insere no banco |

---

## Problemas Encontrados e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| Prisma 7 `prisma-client-js` rejeita URL no constructor | Prisma 7 mudou API: `datasourceUrl` e `datasources` são "unknown property" | Downgrade para Prisma 6 que aceita `url = env("DATABASE_URL")` no schema |
| CyberPanel esvazia vhost.conf no restart do OLS | CyberPanel regenera configs a partir do SQLite, sobrescrevendo edições manuais | Proteger arquivo com `chattr +i` (flag imutable do filesystem) |
| ACME challenge 404 com vhost proxy | O `context /` (proxy) captura todas as rotas antes do `/.well-known/acme-challenge` | Gerar SSL via `cyberpanel issueSSL` antes de configurar o proxy |
| SSL issueSSL falha com Cloudflare proxy ativo | ACME HTTP-01 challenge não chega ao servidor com Cloudflare proxy | Desativar proxy temporariamente no Cloudflare, emitir cert, reativar |
| Frontend /admin visível sem login | Rota client-side não verificava auth antes de renderizar | Adicionado guard no layout: verifica `isAuthenticated` + `role === 'ADMIN'`, redireciona para /login |
| Listener map do OLS fora do bloco | sed inseriu map fora do listener, OLS não roteava para o vhost | Corrigido posicionamento do map dentro do listener Default e SSL |
| Redis ETIMEDOUT do container | Redis bind 127.0.0.1, Docker bridge é 172.x, nft firewall bloqueava | Bind 0.0.0.0, senha Redis, nft rule para 172.16.0.0/12 tcp 6379/9200 |
| Redis protected-mode | Conexão externa sem auth rejeitada | Configurado requirepass no Redis |
| Frontend SSR crash em /c/[slug] | ProductCard acessava product.variations.length mas API de listagem não inclui variations | Optional chaining: `product.variations ?? []` |
| /produtos e /marca/[slug] 404 | Páginas não existiam no frontend | Criadas as rotas |
| "Erro ao criar conta" genérico | Frontend lia `data.message` mas HttpExceptionFilter retorna `{ error: { message, details } }` | Corrigido para ler `data.error.message` e `data.error.details` |
| Frontend healthcheck unhealthy | Next.js standalone bind no IP do container, não em localhost | Adicionado HOSTNAME=0.0.0.0 no Dockerfile |
| /admin redireciona para /minha-conta | Layout admin enviava para /login sem returnTo | Adicionado `?returnTo=/admin` no redirect |
| Checkout sem endereço completo | Só tinha campo CEP | Formulário completo com ViaCEP auto-fill (rua, bairro, cidade, UF) |
| Sessão perde ao atualizar página | Zustand auth store reiniciava com user:null no reload, token ficava no localStorage mas ninguém restaurava | Adicionado hydrate() no Providers que chama GET /users/me se accessToken existe. Layouts esperam isHydrated antes de redirect |
| Imagem quebrada na galeria | next.config.ts tinha cdn.miniatures3d.com mas CDN real é cdn.elitepinup3d.com.br | Corrigido remotePatterns para o domínio correto |
| Upload não atualiza galeria | invalidateQueries não forçava re-fetch imediato | Trocado para refetchQueries com await |
| Admin CRUD falha silenciosamente | Mutations sem onError, catch com console.error | Adicionado extractError helper + onError em todas as mutations + div de erro visível |
| Schema prod desatualizado | Tabelas de Sprint 1-4 não existiam no banco de produção | prisma db push no servidor + force-recreate containers |
| CI falhando (lint errors) | Unused imports (Image, useState, getFullUrl), unescaped entities, explicit any | Removidos imports não usados, escapados caracteres, tipagem correta |
| Deploy não atualiza containers | docker compose up -d sem --force-recreate não recriava containers com tag :latest | Adicionado --force-recreate no workflow de deploy |
| Binário ao editar produto com imagem | OLS LiteSpeed cache cacheava resposta corrompida de rotas do admin | Adicionado noCacheUrl no vhost.conf para /admin, /api, /login, /minha-conta, /checkout |
| ProductImage FK RESTRICT | Deletar MediaFile falhava se usado em ProductImage | Alterado para onDelete: Cascade no schema + aplicado via ALTER TABLE no banco prod |
| Produto variável exigia preço | DTO usava @IsPositive no basePrice, variável não tem preço pai | Trocado para @Min(0), frontend envia 0 quando type=variable |
| categoryId/brandId/tagIds must be UUID | DTOs usavam @IsUUID mas Prisma gera CUIDs | Trocado para @IsString |
| Atributos: valor não aparecia após criar | invalidateQueries não forçava re-fetch imediato | Trocado para refetchQueries com await, form fica aberto para adicionar vários valores |
| Actions Node.js 20 deprecated | docker/login-action@v3, docker/build-push-action@v6 usam Node 20 | Atualizado para v4 e v7 respectivamente |
| Escalas não apareciam na tela admin | ScalesController.findAll retornava array puro, frontend fazia data.data que era undefined | Wrapper { data: ... } no controller |
| Email templates admin não carregava | EmailTemplateController retornava array puro sem { data: ... } | Wrapper { data: ... } + error handling no frontend + try/catch no JSON.parse |
| Galeria zoom muito pequeno | Dialog usava aspect-[4/3] fixo + imagem gallery (800px) + sizes="800px" | Removido aspect ratio, usar imagem full (1600px), max-h-[80vh], tag img nativa |
| Sidebar admin footer sumia | aside sem h-screen, crescia com conteúdo principal | h-screen sticky top-0, nav overflow-y-auto, header/footer flex-shrink-0 |
| Rotas /me e /:id conflitavam | PUT :id declarado antes de PUT me, NestJS casava 'me' como :id | Reordenar: rotas /me primeiro, /:id por último |

---

## Como Atualizar Este Arquivo

Sempre que:
1. Uma decisão técnica for tomada → adicione em "Decisões Tomadas"
2. Uma fase for concluída → marque os checkboxes em "Progresso Atual"
3. Uma convenção nova for estabelecida → adicione na regra relevante
4. Um bug recorrente for identificado → adicione uma nota de atenção
5. Uma dependência for adicionada/removida → atualize a tabela de stack

**Comando sugerido:** Ao final de cada sessão de trabalho, peça ao Claude:
"Atualize o CLAUDE.md com o progresso de hoje e qualquer decisão nova que tomamos."
