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

**NUNCA confie em dados do frontend.** Todo cálculo de preço, desconto, frete e validação é feito exclusivamente no backend.

**PricingService (`backend/src/pricing/`) é o ÚNICO ponto de cálculo de preço para pedidos.** Todo `createOrder()` passa pelo `PricingService.calculateOrderPricing()` que valida: preço base do banco, variação, escala (percentageIncrease), cupom (com restrições categoria/tag), frete, e desconto por método de pagamento. **Regra nova que afeta preço = método novo no PricingService + teste isolado + teste de combinação no "CHECKOUT COMPLETO".** Ver `docs/02-TDD-STRATEGY.md` seção "Regra de Ouro".

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

### Variações e Frete (REGRA CRÍTICA)
- Produto variável (`type=variable`): `basePrice=0`, preço vem da variação
- Variações = modelos/estilos do produto (A, B, C). Seletor: **dropdown**
- Frete exige seleção de variação primeiro
- Peso/dimensões: variação herda do pai se null
- Preço seguro: `salePrice ?? price` da variação
- Mínimos Melhor Envio: peso >= 0.3kg, largura >= 11cm, altura >= 2cm, comprimento >= 16cm
- ExtraDays: MAX entre produtos (produto > tag > categoria) + dias do método de envio

### Escalas (CONCEITO SEPARADO DE VARIAÇÕES)
- Escalas = tamanho de impressão 3D (28mm, 32mm, 54mm, 75mm). NÃO são variações.
- Seletor na página: **radio buttons** com diferença de preço
- **ScaleRuleSet**: regra nomeada que define quais escalas se aplicam e o % de incremento de cada
- Atribuída a Produto, Tag ou Categoria. Prioridade: **Produto > Tag > Categoria**
- `noScales` (boolean) em Produto e Tag: se true, escalas NÃO se aplicam
- Cálculo: `preçoFinal = preçoBase × (1 + percentageIncrease / 100)`
- Carrinho armazena: scaleId, scaleName, scalePercentage. Mesmo produto + escala diferente = linha separada
- Preço no carrinho já inclui multiplicador de escala

### Frete Grátis
Configurável por faixa de CEP + valor mínimo. Desconto de pagamento NUNCA se aplica ao frete.

### Desconto por Método de Pagamento
Configurável no admin (PIX = 10%, Boleto = 5%). Calculado sobre subtotal (sem frete).

---

## Servidor de Produção

- **Hardware:** AMD Ryzen 5 2600, 32GB DDR4, NVMe 2TB
- **OS:** Ubuntu 24.04 LTS
- **IP:** 24.152.39.104 (SSH porta 2222, usuário masterdaweb)
- **Domínio:** elitepinup3d.com.br (DNS via Cloudflare)
- **Reverse Proxy:** OpenLiteSpeed 1.8.4 via CyberPanel (NÃO usar Nginx)
- **Containers existentes (NÃO mexer):** arsenal_app (:3001), arsenal_db (PG18), n8n (:5678)
- **Nosso projeto:** elitepinup_backend (:3002), elitepinup_frontend (:3003), elitepinup_db (PG18 interno)
- **Deploy:** push → GitHub Actions → GHCR build+push → SSH pull + `--force-recreate`
- **Storage:** R2 bucket `elitepinup`, CDN: cdn.elitepinup3d.com.br
- **OLS vhost:** protegido com `chattr +i` (CyberPanel sobrescreve sem isso)

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
| Prisma 6, NÃO 7 | Prisma 7 não aceita URL no constructor/schema. Incompatível com Docker |
| OLS, NÃO Nginx | Servidor usa CyberPanel/OLS. Nginx seria redundante e conflitante |
| `chattr +i` no vhost | CyberPanel esvazia vhost.conf em cada restart do OLS |
| Redis/ES no host | Containers acessam via `extra_hosts: host.docker.internal`. Redis com senha, bind 0.0.0.0, firewall nft |
| Portas 3002/3003 | 3000 = nghttpx, 3001 = ERP arsenal. Não usar |
| `--force-recreate` no deploy | Sem isso, containers não atualizam mesmo com imagem nova |
| `{ data: result }` em controllers | Sem wrapper, frontend faz `data.data` = undefined |
| Rotas `/me` antes de `/:id` | NestJS match por ordem. `/me` depois de `/:id` casa 'me' como ID |
| `@Min(0)` não `@IsPositive` para preço | Produto variável tem basePrice=0 |
| `@IsString` não `@IsUUID` para IDs | Prisma gera CUIDs, não UUIDs |
| OLS noCacheUrl obrigatório | /admin, /api, /login, /minha-conta, /checkout, /p/, /c/, /t/, /m/, /produtos — sem isso, binário corrompido |
| MELHOR_ENVIO_TOKEN (com underscore) | docker-compose deve usar mesmo nome que o código |
| `NEXT_PUBLIC_*` no build time | Precisa de ARG/ENV no Dockerfile + build-arg no workflow |
| Auth hydrate no app init | Zustand chama GET /users/me se token existe. Layouts esperam `isHydrated` |
| Migrations manuais em prod | Sem `.env` local, `prisma migrate deploy` falha. Rodar SQL direto via `docker exec elitepinup_db psql`. Colunas são camelCase (Prisma sem @map) |
| Webhook MP: data.id no query param | HMAC calculado com data.id do query param, não do body |
| Desconto sobre subtotal | PIX/Boleto desconto = subtotal × %. NUNCA incluir frete no cálculo |
| PricingService obrigatório | Todo createOrder() passa pelo PricingService. Regra de preço nova = teste no "CHECKOUT COMPLETO" |
| Escalas simplificadas | Scale table removida. ScaleRuleItem tem name próprio (não FK). 1 página admin |
| Abas CSS toggle (não unmount) | ProductForm renderiza todas as abas, toggle via CSS hidden/block. Evita perda de dados |
| Cart chave composta | Unicidade = productId + variationId + scaleId. Remove/update usam query params `?variationId=&scaleId=` |

---

## Última Sessão

- **Data:** 05/04/2026 (sessão 5)
- **Feito:**
  - Fix: migrations automáticas no deploy (docker-entrypoint.sh + prisma migrate deploy)
  - Fix: baseline das 3 migrations existentes no servidor
  - Simplificação escalas: removeu tabela Scale, ScaleRuleItem com name próprio, 1 página admin (entrar na regra)
  - **PricingService**: validação completa de preços no checkout (base/variação/escala/cupom/frete/pagamento)
  - Orders.createOrder() agora delega ao PricingService
  - Payments.createPayment() agora inclui couponDiscount no amount
  - Doc 02-TDD-STRATEGY.md: "Regra de Ouro — Testes de Precificação" + checklist Orders/Pricing
- **Total:** 44 suites (44 pass), 412 testes, 0 erros TS
- **Próximo passo:**
  1. Testar fluxo completo: criar regra escala → atribuir a categoria → produto mostra escalas → comprar → carrinho correto
  2. Email alerta de estoque baixo
  3. Expiração automática de pedidos (BullMQ delayed)

---

## Como Atualizar Este Arquivo

Ao final de cada sessão, atualize:
1. **Pendências Ativas** — marque concluídos, adicione novos
2. **Última Sessão** — substitua com resumo do dia
3. **Gotchas** — adicione se descobriu armadilha nova
4. **Estado Atual** — atualize números se mudaram significativamente

**NÃO adicione:** histórico detalhado de sprints, lista de bugfixes resolvidos, decisões óbvias que já estão no código. Isso é o git log.
