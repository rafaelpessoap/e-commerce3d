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
- [x] `/admin/marcas`: marcas table + criar inline
- [x] `/admin/tags`: tags table com color + criar inline
- [x] `/admin/frete`: free shipping rules + criar
- [x] `/admin/configuracoes`: settings display
- [x] `/admin/blog`: publicar/despublicar posts
- [x] Proteção de rotas: /admin requer login+ADMIN, /minha-conta requer login
- [x] Build passing (41 rotas, TypeScript OK)

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
- [x] OLS vhost criado via CyberPanel, customizado com proxy reverso
- [x] SSL: certificado Let's Encrypt gerado via CyberPanel
- [x] Containers rodando: elitepinup_db (healthy), elitepinup_backend (healthy), elitepinup_frontend (up)
- [x] API respondendo: https://elitepinup3d.com.br/api/health → {"data":{"status":"ok"}}
- [x] Frontend servindo: https://elitepinup3d.com.br/ → 200
- [x] Prisma db push executado (tabelas criadas)
- [x] Admin criado: rafaelzezao@gmail.com / Admin@2026!
- [x] Deploy automático funcionando (push para main → build → deploy via SSH)
- [x] R2 testado e funcionando (upload OK)
- [x] Proteção de rotas: /admin exige login + ADMIN, /minha-conta exige login

---

## Pendências Restantes

### PRÓXIMA SESSÃO — Prioridade alta
- [ ] **Prisma seed** — dados iniciais: categorias, escalas padrão (28mm, 32mm, 75mm), cupom WELCOME10
- [ ] **Teste manual end-to-end** — registro → login → admin → criar produto → carrinho → checkout → pedido
- [ ] **Configurar Mercado Pago** — obter tokens, atualizar .env no servidor
- [ ] **Configurar Melhor Envio** — obter token, atualizar .env no servidor
- [ ] **Prisma migrations** — criar migration inicial a partir do schema atual (`prisma migrate dev --name init`)

### MELHORIAS PÓS-LAUNCH
- [ ] **Cache Redis por rota** — CacheInterceptor em /products, /categories
- [ ] **Cloudflare cache rules** — assets estáticos e API GET
- [ ] **Testes de carga** — k6/Artillery
- [ ] **Test infrastructure** — test/helpers/, test/fixtures/, jest configs de integração
- [ ] **Testes E2E** — supertest + banco real, testes de segurança (IDOR, 401, 403)
- [ ] **Componentes frontend** — scale-selector, variation-selector, shipping-simulator, mini-cart, breadcrumb, loading skeletons
- [ ] **Email templates** — React Email (hoje usa HTML inline)
- [ ] **BullMQ email processor** — fila assíncrona (hoje síncrono)
- [ ] **Cloudflare Origin Certificate** — substituir Let's Encrypt para evitar renovação manual (dura 15 anos)

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
| 2026-04-02 | Backend na porta 4000 (não 3000) | Porta 3000 já em uso ou reservada, backend roda em 4000 |
| 2026-04-02 | bcrypt salt rounds = 12 | Recomendação do doc de segurança para 2026+, mais seguro que 10 |
| 2026-04-02 | Access token 15min, refresh 7d | Spec do módulo de auth. Refresh é JWT armazenado no banco com rotação |
| 2026-04-03 | OLS (não Nginx) como proxy | Servidor usa CyberPanel/OLS. Nginx no Docker seria redundante e conflitaria |
| 2026-04-03 | Portas 3002/3003 (não 4000/3000) | 3000 ocupada por nghttpx, 3001 pelo ERP. Backend:3002, Frontend:3003 |
| 2026-04-03 | Redis/ES no host (não containers) | Redis 7.0.15 e ES 9.3.2 já rodam no host. Containers acessam via extra_hosts host.docker.internal |
| 2026-04-03 | GHCR (não build local) | Imagens Docker buildadas no GitHub Actions e pushadas para ghcr.io. Servidor só faz pull |
| 2026-04-03 | chattr +i no vhost.conf | CyberPanel esvazia vhost.conf em cada restart do OLS. chattr +i protege contra overwrite |
| 2026-04-03 | Cloudflare R2 bucket: elitepinup | CDN: cdn.elitepinup3d.com.br. Token S3 API testado e funcionando |

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
