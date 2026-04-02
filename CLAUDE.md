# CLAUDE.md — Memória Persistente do Projeto

> Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão.
> Ele contém o contexto, regras e decisões do projeto para que o Claude mantenha
> consistência entre sessões. ATUALIZE este arquivo sempre que uma decisão
> importante for tomada ou uma convenção for estabelecida.

---

## Identidade do Projeto

- **Nome temporário:** miniatures-store (nome definitivo a definir)
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
| ORM | Prisma | 7.x |
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
- **OS:** Ubuntu 24
- **Já rodando:** MariaDB (Arsenal Craft), PostgreSQL 18, Redis, Elasticsearch 9.3
- **Deploy:** Docker containers via GitHub Actions (SSH + docker compose)
- **Proxy:** Cloudflare → Nginx → App

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
- [x] Configurar Docker Compose (dev, test)
- [x] Inicializar NestJS 11 com TypeScript strict
- [x] Inicializar Next.js 16.2 com App Router + shadcn/ui
- [x] Criar Prisma 7 schema inicial (todos os models)
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
- [x] JWT Strategy (passport-jwt, access 15m, refresh 7d)
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
- [x] Emails transacionais — EmailService com Nodemailer (TDD: 4 testes)

### Fase 4 — Pós-venda ✅
- [x] Wishlist module — add, remove, findAll com deduplicação (TDD: 4 testes)
- [x] Email module — sendMail, orderConfirmation, statusChange, welcome, passwordReset (TDD: 4 testes)
- [x] Minha Conta: Users/Addresses/Orders — implementados nas fases anteriores

### Fase 5 — Admin ✅
- [x] Admin Dashboard — getDashboardStats, getOrdersByStatus (TDD: 2 testes)
- [x] CRUD completo: Products, Categories, Tags, Brands, Scales, Coupons, FreeShippingRules, Bundles — @Roles('ADMIN')
- [x] Gestão de pedidos: updateStatus com state machine + histórico

### Frontend Next.js ✅ (15 rotas)
- [x] Infra: API client (axios), types, React Query provider, Zustand stores (auth, cart)
- [x] Layout raiz: metadata pt-BR, Geist font, Providers wrapper
- [x] Componentes: Header, Footer, ProductCard, Pagination, EmptyState, shadcn (button, input, label, card, badge, separator)
- [x] `/` Home: hero, categorias destaque, CTA registro
- [x] `/categoria/[slug]`: SSR, metadata dinâmica, grid de produtos
- [x] `/produto/[slug]`: galeria, preço PIX, variações/escalas, tags, AddToCartButton
- [x] `/busca`: busca client-side com React Query, paginação
- [x] `/login` + `/cadastro`: forms com validação, auth store integration
- [x] `/carrinho`: items com +/-, remove, cupom, resumo, link checkout
- [x] `/checkout`: endereço, método pagamento (PIX/boleto/cartão com desconto), resumo, criar pedido
- [x] `/pedido/confirmacao/[id]`: confirmação pós-compra
- [x] `/minha-conta`: dashboard com cards (pedidos, wishlist, dados)
- [x] `/minha-conta/pedidos`: lista com status badges
- [x] `/minha-conta/pedidos/[id]`: detalhe com timeline visual de 5 estados
- [x] `/minha-conta/dados`: editar perfil + alterar senha
- [x] `/minha-conta/lista-de-desejos`: lista com remove
- [x] `/admin`: dashboard com 4 cards de métricas + pedidos por status
- [x] `/admin/produtos`: tabela paginada, link criar/editar
- [x] `/admin/produtos/novo`: form com nome, descrição, preço, SKU
- [x] `/admin/pedidos`: tabela com filtro por status (Select)
- [x] `/admin/pedidos/[id]`: detalhe, update status (state machine), histórico timeline
- [x] `/admin/categorias`: lista + criar inline
- [x] `/admin/cupons`: tabela com código, tipo, valor, usos, status
- [x] `/admin/escalas`: lista + criar inline (nome, código, tamanho)
- [x] Build passing (22 rotas, TypeScript OK)

### Fase 6 — SEO e Performance
- [ ] SEO (meta tags, sitemap, schema.org)
- [ ] Blog
- [ ] Cache (Redis + Cloudflare)
- [ ] Testes de carga

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
| 2026-04-02 | Prisma 7 (não 6) | Prisma 7 é a versão atual, mudou API: URL vai no prisma.config.ts, provider é "prisma-client" |
| 2026-04-02 | Elasticsearch 8.17 (não 9.3) | ES 9.3 não existe ainda no Docker Hub, usando 8.17 (última estável) |
| 2026-04-02 | Backend na porta 4000 (não 3000) | Porta 3000 já em uso ou reservada, backend roda em 4000 |
| 2026-04-02 | prisma-client-js (não prisma-client) | Prisma 7 com prisma-client gera ESM incompatível com NestJS CJS. prisma-client-js funciona. URL fica no prisma.config.ts |
| 2026-04-02 | bcrypt salt rounds = 12 | Recomendação do doc de segurança para 2026+, mais seguro que 10 |
| 2026-04-02 | Access token 15min, refresh 7d | Spec do módulo de auth. Refresh é JWT armazenado no banco com rotação |

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
