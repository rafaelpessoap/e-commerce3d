# CLAUDE.md — Memória Persistente do Projeto

> Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão.
> Contém contexto, regras e decisões do projeto. ATUALIZE ao final de cada sessão.
> Para histórico detalhado, consulte o git log e os docs na pasta `docs/`.

---

## Identidade do Projeto

- **Nome:** ElitePinup3D
- **Repositório:** https://github.com/rafaelpessoap/e-commerce3d
- **Dono:** Rafael Pessoa (rafaelzezao@gmail.com)
- **Objetivo:** E-commerce de miniaturas 3D (pinups) como piloto. Após validação, migrar arsenalcraft.com.br (12k+ produtos WooCommerce).

---

## Stack Tecnológica (FIXA — não sugerir alternativas)

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Runtime | Node.js LTS | 24.x |
| Linguagem | TypeScript | 6.0 |
| Backend | NestJS | 11.x |
| Frontend | Next.js (App Router) | 16.2.x |
| UI | React + shadcn/ui + Tailwind CSS | 19.2.x / CLI v4 |
| Banco de dados | PostgreSQL | 18 |
| ORM | Prisma | 6.x (NÃO usar Prisma 7 — incompatível com Docker) |
| Cache | Redis | 7.0.15 (host, não container) |
| Busca | Elasticsearch | 8.17 (host, não container) |
| Fila | BullMQ | 5.71.x |
| Testes backend | Jest + Supertest | Última |
| Testes frontend | Vitest + React Testing Library | Última |
| Testes E2E | Playwright | Última |
| Email | Nodemailer + React Email | SMTP próprio |
| Storage | Cloudflare R2 | S3-compatível |
| CDN | Cloudflare | cdn.elitepinup3d.com.br |
| Pagamento | Mercado Pago | API v1 |
| Frete | Melhor Envio | API v2 |
| CI/CD | GitHub Actions → GHCR → SSH deploy | - |
| Container | Docker + Docker Compose | - |

---

## Regra #1: TDD É INEGOCIÁVEL

Ciclo obrigatório: RED → GREEN → REFACTOR.

**NUNCA implemente sem o teste existir antes.** Se pedir "cria o XService":
1. Criar `x.service.spec.ts` com casos de teste
2. Rodar `npm run test` → confirmar que FALHAM
3. Criar `x.service.ts` para fazer passar
4. Rodar `npm run test` → confirmar que PASSAM

Referência: `docs/02-TDD-STRATEGY.md`

---

## Regra #2: Segurança desde o Dia 1

**NUNCA confie em dados do frontend.** Todo cálculo de preço, desconto, frete e validação é feito exclusivamente no backend via `PricingService` (ver Regra #6).

Regras críticas:
- DTOs: `whitelist: true` + `forbidNonWhitelisted: true`
- Registro: role CUSTOMER forçado (campo role NÃO existe no DTO)
- Preços: buscados no banco, NUNCA aceitos do request
- Webhooks MP: verificar assinatura HMAC + double-check + idempotência
- OwnershipGuard em TODO recurso de usuário
- Upload: validar extensão + MIME real + nome aleatório
- Sanitizar HTML com DOMPurify
- Senhas: bcrypt salt 12, NUNCA retornar em responses
- Rate limiting no login (5/min)

Referência: `docs/08-SECURITY.md`

---

## Regra #3: Convenções de Código

- Arquivos: `kebab-case` | Classes: `PascalCase` | Variáveis: `camelCase` | Constantes: `UPPER_SNAKE_CASE`
- Banco: `snake_case` plural | Rotas: `/api/v1/kebab-case`
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`)
- Branches: `main` (prod), `develop` (dev), `feature/*`, `fix/*`, `hotfix/*`

Resposta API:
```typescript
{ data: T }                                              // Sucesso singular
{ data: T[], meta: { total, page, perPage, lastPage } }  // Sucesso paginado
{ error: { statusCode, message, details? } }              // Erro
```

**IMPORTANTE:** Controllers SEMPRE retornam `{ data: result }`. Sem wrapper → frontend quebra.

Referência: `docs/01-SKELETON.md`

---

## Regra #4: Estrutura do Projeto

```
e-commerce3d/
├── backend/src/modules/     # Módulos por domínio (NestJS)
├── backend/src/common/      # Guards, interceptors, pipes, decorators
├── backend/prisma/          # Schema, migrations, seed
├── frontend/src/app/        # App Router (páginas)
├── frontend/src/components/ # Componentes (ui/, product/, cart/, etc.)
├── frontend/src/lib/        # API client, utilitários
├── frontend/src/store/      # Zustand stores
├── docker/                  # Dockerfiles e compose
└── docs/                    # Documentação do projeto
```

---

## Regra #5: Domínio do Negócio — Miniaturas 3D

### Bundles
Preço = soma dos componentes × (1 - desconto). Atualiza automaticamente. Estoque = menor entre componentes.

### Fluxo de Produção (State Machine)
```
pending_payment → payment_approved → production_queue → producing → packaging → shipped → delivered
```
Extras: payment_rejected, cancelled, refunded. Cada transição: histórico + email.

### Variações e Frete
- Produto variável: `basePrice=0`, preço vem da variação. Seletor: **dropdown**
- Preço seguro: `salePrice ?? price`. Peso/dimensões: herda do pai se null
- Mínimos Melhor Envio: peso >= 0.3kg, largura >= 11cm, altura >= 2cm, comprimento >= 16cm

### Escalas (CONCEITO SEPARADO DE VARIAÇÕES)
- Escalas = tamanho de impressão (28mm, 32mm, 75mm). Seletor: **radio buttons**
- **ScaleRuleSet** com escalas inline (name + percentageIncrease). Prioridade: **Produto > Tag > Categoria**
- `noScales` em Produto/Tag: se true, escalas NÃO se aplicam
- Carrinho: scaleId = ScaleRuleItem.id. Mesmo produto + escala diferente = linha separada

### Frete e Descontos
- Frete grátis: por faixa de CEP + valor mínimo. Desconto de pagamento NUNCA se aplica ao frete
- PIX = 10%, Boleto = 5% — sobre subtotal (sem frete)

---

## Regra #6: Todo Preço Passa pelo PricingService — SEM EXCEÇÃO

**`PricingService` (`backend/src/pricing/`) é o ÚNICO lugar onde preços de pedido são calculados.** Qualquer feature que altere valor (desconto, taxa, promoção, cashback, frete) DEVE:

1. Criar método privado no `PricingService` e chamar em `calculateOrderPricing()`
2. Adicionar `describe('nome da regra')` isolado em `pricing.service.spec.ts`
3. Adicionar caso no `describe('combinações — CHECKOUT COMPLETO')` — o **guardião final** que simula checkout real com TODAS as regras ativas
4. **NUNCA** calcular preço/desconto fora do PricingService. Feature sem teste de combinação = **INCOMPLETA**

| Passo | Regra | Método |
|-------|-------|--------|
| 1 | Preço base / variação / salePrice | `verifyItems()` |
| 2 | Escala (percentageIncrease) | `verifyItems()` → `ScalesService` |
| 3 | Cupom (%, fixo, frete grátis, restrições) | `applyCoupon()` → `CouponsService` |
| 4 | Frete (validação, free shipping) | `resolveShipping()` |
| 5 | Desconto pagamento (PIX/Boleto) | `calculatePaymentDiscount()` → `PaymentsService` |

**Ao adicionar regra nova:** inserir linha nesta tabela. Ref: `docs/02-TDD-STRATEGY.md` "Regra de Ouro"

---

## Servidor de Produção

- **IP:** 24.152.39.104 (SSH porta 2222, user masterdaweb) | Ubuntu 24.04 | AMD Ryzen 5 2600, 32GB, NVMe 2TB
- **Reverse Proxy:** OpenLiteSpeed 1.8.4 via CyberPanel (NÃO usar Nginx). vhost com `chattr +i`
- **Containers:** elitepinup_backend (:3002), elitepinup_frontend (:3003), elitepinup_db (PG18). NÃO mexer: arsenal_app (:3001), n8n (:5678)
- **Deploy:** push → GitHub Actions → GHCR → SSH pull + `--force-recreate` → entrypoint roda `prisma migrate deploy`
- **Storage:** R2 `elitepinup`, CDN: cdn.elitepinup3d.com.br

---

## Documentação de Referência

| Documento | Conteúdo |
|-----------|----------|
| `docs/plano-ecommerce-miniaturas.md` | Plano mestre: stack, páginas, features, fases |
| `docs/01-SKELETON.md` | Estrutura de pastas, convenções |
| `docs/02-TDD-STRATEGY.md` | Regras de TDD, padrões de teste, checklists |
| `docs/03-MODULE-SPECS.md` | Endpoints, DTOs, regras por módulo |
| `docs/04-DOCKER-SPECS.md` | Docker Compose (dev, test, prod), Dockerfiles |
| `docs/05-CICD-SPECS.md` | GitHub Actions: CI, security, deploy |
| `docs/06-PRISMA-SCHEMA.md` | Schema do banco, índices, seed data |
| `docs/07-IMPLEMENTATION-GUIDE.md` | Passo-a-passo por fase |
| `docs/08-SECURITY.md` | Regras de segurança, checklists |

---

## Estado Atual do Projeto

**Fases 0-6 completas.** Backend, frontend, deploy, CI/CD — tudo implementado e no ar.

**Números:** 44 test suites (44 pass), 412 testes, ~40 rotas frontend, 0 erros TS.

**Site:** https://elitepinup3d.com.br (API + Frontend funcionando)
**Admin:** rafaelzezao@gmail.com / Admin@2026!

**Módulos implementados:** Auth, Users, Addresses, Categories, Tags, Brands, Scales (ScaleRuleSet com escalas inline por regra, prioridade produto/tag/categoria), Products (variações dropdown + escalas radio + atributos + galeria MediaFile 4 tamanhos WebP), Bundles, Cart (Redis + anônimo + escala/variação com chave composta), Orders (state machine), **Pricing (validação completa: base/variação/escala/cupom/frete/pagamento)**, Payments (MP: PIX + Cartão + Boleto), Shipping (Melhor Envio real), Coupons (restrições categoria/tag/cliente), Wishlist, Reviews (recompensa cupom), Search (Elasticsearch), SEO, Blog, Email (React Email + templates editáveis admin + BullMQ), Stock (reserva/confirma/libera/ajuste + audit log), Media (Sharp → 4 WebP), Dashboard admin, Settings (key-value), CheckoutLog (debug).

---

## Pendências Ativas

### Prioridade Alta
- [ ] Email de alerta de estoque baixo — `checkLowStock()` retorna dados mas NÃO envia email
- [ ] Expiração automática de pedidos — PIX 30min, Boleto 3 dias (BullMQ delayed)

### Prioridade Média
- [ ] Blog admin: criar/editar posts com TipTap (CRUD backend existe, falta frontend de edição)
- [ ] Mercado Pago Sprint 4: resiliência — expiração BullMQ, testes E2E com cartões teste
- [ ] MP Sandbox 500 — ticket aberto no suporte. Credenciais de produção funcionam

### Pós-Lançamento
- [ ] Cache Redis por rota (CacheInterceptor) — baseado em métricas reais
- [ ] Testes de carga (k6/Artillery)
- [ ] Cloudflare Origin Certificate (15 anos)

---

## Gotchas Importantes (armadilhas recorrentes)

Estas são decisões e problemas que DEVEM ser lembrados para evitar retrabalho:

| Gotcha | Detalhe |
|--------|---------|
| Prisma 6, NÃO 7 | Prisma 7 incompatível com Docker. NÃO atualizar |
| Redis/ES no host | Containers: `extra_hosts: host.docker.internal`. Redis com senha, bind 0.0.0.0 |
| Portas 3002/3003 | 3000 = nghttpx, 3001 = ERP arsenal. Não usar |
| `{ data: result }` em controllers | Sem wrapper → frontend quebra |
| Rotas `/me` antes de `/:id` | NestJS match por ordem. `/me` depois de `/:id` casa 'me' como ID |
| `@Min(0)` não `@IsPositive` para preço | Produto variável tem basePrice=0 |
| `@IsString` não `@IsUUID` para IDs | Prisma gera CUIDs, não UUIDs |
| OLS noCacheUrl obrigatório | /admin, /api, /login, /checkout, /p/, /produtos — sem isso, binário corrompido |
| `NEXT_PUBLIC_*` no build time | Precisa de ARG/ENV no Dockerfile + build-arg no workflow |
| Migrations automáticas | `docker-entrypoint.sh` roda `prisma migrate deploy` antes do app. Colunas camelCase (sem @map) |
| Webhook MP: data.id no query param | HMAC calculado com data.id do query param, não do body |
| Abas CSS toggle (não unmount) | ProductForm: toggle via CSS hidden/block. Evita perda de dados |
| Cart chave composta | Unicidade = productId + variationId + scaleId |

---

## Última Sessão

- **Data:** 05/04/2026 (sessão 5)
- **Feito:** Deploy auto-migrate (entrypoint.sh), simplificação escalas (1 página, sem tabela Scale), PricingService (Regra #6 — valida tudo no checkout), checkout UX (imagens, variação/escala no resumo, CPF com validação real, pre-fill dados do user)
- **Total:** 44 suites (44 pass), 412 testes, 0 erros TS
- **Próximo passo:**
  1. Testar fluxo completo: criar regra escala → atribuir a categoria → produto mostra escalas → comprar → checkout correto
  2. Email alerta de estoque baixo
  3. Expiração automática de pedidos (BullMQ delayed)

---
*Ao final de cada sessão: atualize Última Sessão, Pendências, Gotchas, Estado Atual. NÃO adicione histórico — isso é o git log.*
