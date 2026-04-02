# 01 — Estrutura do Projeto (Skeleton)

> Este documento descreve TODA a estrutura de pastas e arquivos do projeto.
> Cada arquivo listado aqui tem uma descrição do que deve conter.
> Use este documento como referência ao criar cada arquivo no VSCode com o Claude.

---

## Raiz do Projeto

```
miniatures-store/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Pipeline de CI (lint, typecheck, testes)
│       ├── security.yml              # Scan de vulnerabilidades (npm audit, Snyk/Trivy)
│       └── deploy.yml                # Build de imagens Docker + deploy para servidor
├── docker/
│   ├── docker-compose.dev.yml        # Ambiente de desenvolvimento local
│   ├── docker-compose.test.yml       # Ambiente de testes (efêmero, tmpfs)
│   ├── docker-compose.prod.yml       # Ambiente de produção
│   ├── backend.Dockerfile            # Multi-stage build do NestJS
│   ├── frontend.Dockerfile           # Multi-stage build do Next.js
│   └── nginx/
│       ├── nginx.dev.conf            # Config nginx para dev (proxy simples)
│       ├── nginx.prod.conf           # Config nginx para prod (cache, SSL, headers)
│       └── ssl/                      # Certificados SSL (gitignored)
├── backend/                          # Projeto NestJS
├── frontend/                         # Projeto Next.js
├── docs/                             # Documentação adicional
│   ├── ADR/                          # Architecture Decision Records
│   │   └── 001-stack-tecnologica.md  # Primeira ADR: por que essa stack
│   ├── api/                          # Docs da API (gerado via Swagger)
│   └── setup/                        # Guias de setup do ambiente
│       ├── local-dev.md              # Como rodar localmente
│       ├── production.md             # Como fazer deploy
│       └── troubleshooting.md        # Problemas comuns
├── .env.example                      # Variáveis de ambiente (template)
├── .gitignore                        # Ignores globais
├── Makefile                          # Atalhos de comandos (make dev, make test, etc.)
└── README.md                         # Visão geral + quickstart
```

---

## Backend (NestJS)

```
backend/
├── src/
│   ├── main.ts                       # Bootstrap da aplicação
│   ├── app.module.ts                 # Módulo raiz (importa todos os módulos)
│   ├── app.controller.ts             # Health check endpoint (GET /)
│   ├── app.controller.spec.ts        # Teste do health check
│   │
│   ├── config/
│   │   ├── app.config.ts             # Config geral (port, env, cors)
│   │   ├── database.config.ts        # Config do PostgreSQL/Prisma
│   │   ├── redis.config.ts           # Config do Redis
│   │   ├── elasticsearch.config.ts   # Config do Elasticsearch
│   │   ├── mail.config.ts            # Config do SMTP
│   │   ├── storage.config.ts         # Config do Cloudflare R2
│   │   ├── payment.config.ts         # Config do Mercado Pago
│   │   ├── shipping.config.ts        # Config do Melhor Envio
│   │   └── index.ts                  # Re-exporta tudo
│   │
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts          # Marca rota como pública (sem auth)
│   │   │   ├── roles.decorator.ts           # Define roles necessárias
│   │   │   ├── current-user.decorator.ts    # Extrai user do request
│   │   │   └── api-paginated.decorator.ts   # Swagger decorator para paginação
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts            # Verifica JWT válido
│   │   │   ├── roles.guard.ts               # Verifica role do usuário
│   │   │   └── throttle.guard.ts            # Rate limiting
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts     # Padroniza resposta { data, meta }
│   │   │   ├── logging.interceptor.ts       # Log de requests/responses
│   │   │   └── cache.interceptor.ts         # Cache Redis por rota
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts           # Validação global via class-validator
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts     # Handler de erros HTTP
│   │   │   └── prisma-exception.filter.ts   # Handler de erros do Prisma
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts            # DTO base para paginação
│   │   │   └── api-response.dto.ts          # DTO base para respostas
│   │   ├── interfaces/
│   │   │   ├── paginated-result.interface.ts
│   │   │   └── request-with-user.interface.ts
│   │   └── utils/
│   │       ├── slug.util.ts                 # Geração de slugs únicos
│   │       ├── price.util.ts                # Cálculos de preço (escala, desconto)
│   │       └── date.util.ts                 # Helpers de data (dias úteis, etc.)
│   │
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts           # POST /auth/login, /auth/register, /auth/refresh
│       │   ├── auth.service.ts              # Lógica de autenticação
│       │   ├── auth.service.spec.ts         # *** TESTES PRIMEIRO ***
│       │   ├── auth.controller.spec.ts      # *** TESTES PRIMEIRO ***
│       │   ├── strategies/
│       │   │   ├── jwt.strategy.ts          # Passport JWT strategy
│       │   │   └── jwt-refresh.strategy.ts  # Refresh token strategy
│       │   └── dto/
│       │       ├── login.dto.ts
│       │       ├── register.dto.ts
│       │       └── auth-response.dto.ts
│       │
│       ├── users/
│       │   ├── users.module.ts
│       │   ├── users.controller.ts          # CRUD de usuários
│       │   ├── users.service.ts
│       │   ├── users.service.spec.ts        # *** TESTES PRIMEIRO ***
│       │   ├── users.controller.spec.ts     # *** TESTES PRIMEIRO ***
│       │   └── dto/
│       │       ├── create-user.dto.ts
│       │       ├── update-user.dto.ts
│       │       └── user-response.dto.ts
│       │
│       ├── addresses/
│       │   ├── addresses.module.ts
│       │   ├── addresses.controller.ts      # CRUD de endereços do usuário
│       │   ├── addresses.service.ts
│       │   ├── addresses.service.spec.ts
│       │   ├── addresses.controller.spec.ts
│       │   └── dto/
│       │       ├── create-address.dto.ts
│       │       └── update-address.dto.ts
│       │
│       ├── products/
│       │   ├── products.module.ts
│       │   ├── products.controller.ts       # CRUD de produtos + listagem pública
│       │   ├── products.service.ts
│       │   ├── products.service.spec.ts     # *** TESTES PRIMEIRO ***
│       │   ├── products.controller.spec.ts
│       │   ├── dto/
│       │   │   ├── create-product.dto.ts
│       │   │   ├── update-product.dto.ts
│       │   │   ├── product-response.dto.ts
│       │   │   └── product-filter.dto.ts    # Filtros de busca (categoria, preço, etc.)
│       │   └── product-variations/
│       │       ├── product-variations.service.ts
│       │       ├── product-variations.service.spec.ts
│       │       └── dto/
│       │           ├── create-variation.dto.ts
│       │           └── update-variation.dto.ts
│       │
│       ├── categories/
│       │   ├── categories.module.ts
│       │   ├── categories.controller.ts     # CRUD hierárquico
│       │   ├── categories.service.ts
│       │   ├── categories.service.spec.ts
│       │   ├── categories.controller.spec.ts
│       │   └── dto/
│       │       ├── create-category.dto.ts
│       │       └── update-category.dto.ts
│       │
│       ├── tags/
│       │   ├── tags.module.ts
│       │   ├── tags.controller.ts
│       │   ├── tags.service.ts
│       │   ├── tags.service.spec.ts
│       │   └── dto/ ...
│       │
│       ├── brands/
│       │   ├── brands.module.ts
│       │   ├── brands.controller.ts
│       │   ├── brands.service.ts
│       │   ├── brands.service.spec.ts
│       │   └── dto/ ...
│       │
│       ├── scales/
│       │   ├── scales.module.ts
│       │   ├── scales.controller.ts         # CRUD de escalas + regras por escopo
│       │   ├── scales.service.ts            # Lógica de resolução de escala (produto > tag > categoria)
│       │   ├── scales.service.spec.ts       # *** CRÍTICO: Testar hierarquia de prioridade ***
│       │   ├── scales.controller.spec.ts
│       │   └── dto/
│       │       ├── create-scale-rule.dto.ts
│       │       └── update-scale-rule.dto.ts
│       │
│       ├── bundles/
│       │   ├── bundles.module.ts
│       │   ├── bundles.controller.ts        # CRUD de kits
│       │   ├── bundles.service.ts           # Cálculo automático de preço
│       │   ├── bundles.service.spec.ts      # *** CRÍTICO: Testar cálculo de preço ***
│       │   ├── bundles.controller.spec.ts
│       │   └── dto/
│       │       ├── create-bundle.dto.ts
│       │       └── update-bundle.dto.ts
│       │
│       ├── cart/
│       │   ├── cart.module.ts
│       │   ├── cart.controller.ts           # GET/POST/PUT/DELETE itens do carrinho
│       │   ├── cart.service.ts              # Carrinho em Redis
│       │   ├── cart.service.spec.ts         # *** Testar cálculos, escalas no carrinho ***
│       │   └── dto/
│       │       ├── add-to-cart.dto.ts
│       │       └── update-cart-item.dto.ts
│       │
│       ├── orders/
│       │   ├── orders.module.ts
│       │   ├── orders.controller.ts         # Criar pedido, listar, detalhar, alterar status
│       │   ├── orders.service.ts            # Lógica de criação + state machine
│       │   ├── orders.service.spec.ts       # *** CRÍTICO: Testar state machine ***
│       │   ├── orders.controller.spec.ts
│       │   ├── order-status.machine.ts      # State machine de status
│       │   ├── order-status.machine.spec.ts # *** TESTES PRIMEIRO ***
│       │   └── dto/
│       │       ├── create-order.dto.ts
│       │       ├── update-order-status.dto.ts
│       │       └── order-response.dto.ts
│       │
│       ├── payments/
│       │   ├── payments.module.ts
│       │   ├── payments.controller.ts       # Webhook do Mercado Pago
│       │   ├── payments.service.ts          # Criação de preference, processamento
│       │   ├── payments.service.spec.ts     # *** Mockar API do Mercado Pago ***
│       │   ├── payments.controller.spec.ts
│       │   ├── mercadopago.client.ts        # Client HTTP para API do MP
│       │   └── dto/
│       │       ├── create-payment.dto.ts
│       │       └── webhook-payment.dto.ts
│       │
│       ├── shipping/
│       │   ├── shipping.module.ts
│       │   ├── shipping.controller.ts       # Simulação de frete, contratação
│       │   ├── shipping.service.ts          # Lógica de frete + regras de frete grátis
│       │   ├── shipping.service.spec.ts     # *** Testar regras de frete grátis ***
│       │   ├── shipping.controller.spec.ts
│       │   ├── melhorenvio.client.ts        # Client HTTP para API do Melhor Envio
│       │   ├── free-shipping.service.ts     # Regras de frete grátis (CEP + valor)
│       │   ├── free-shipping.service.spec.ts
│       │   └── dto/
│       │       ├── simulate-shipping.dto.ts
│       │       └── shipping-response.dto.ts
│       │
│       ├── coupons/
│       │   ├── coupons.module.ts
│       │   ├── coupons.controller.ts
│       │   ├── coupons.service.ts           # Validação e aplicação de cupons
│       │   ├── coupons.service.spec.ts      # *** Testar todas as restrições ***
│       │   └── dto/ ...
│       │
│       ├── search/
│       │   ├── search.module.ts
│       │   ├── search.controller.ts         # GET /search?q=&filters=
│       │   ├── search.service.ts            # Queries ao Elasticsearch
│       │   ├── search.service.spec.ts
│       │   ├── search.indexer.ts            # Indexação de produtos
│       │   ├── search.indexer.spec.ts
│       │   └── dto/
│       │       ├── search-query.dto.ts
│       │       └── search-response.dto.ts
│       │
│       ├── seo/
│       │   ├── seo.module.ts
│       │   ├── seo.controller.ts            # CRUD de meta tags por entidade
│       │   ├── seo.service.ts               # Geração de sitemap, schema.org
│       │   ├── seo.service.spec.ts
│       │   ├── sitemap.service.ts           # Geração de sitemap.xml
│       │   ├── sitemap.service.spec.ts
│       │   └── dto/ ...
│       │
│       ├── email/
│       │   ├── email.module.ts
│       │   ├── email.service.ts             # Envio via Nodemailer
│       │   ├── email.service.spec.ts
│       │   ├── email.processor.ts           # BullMQ processor para fila de emails
│       │   ├── email.processor.spec.ts
│       │   └── templates/                   # React Email templates
│       │       ├── order-confirmation.tsx
│       │       ├── order-status-change.tsx
│       │       ├── welcome.tsx
│       │       └── password-reset.tsx
│       │
│       ├── cache/
│       │   ├── cache.module.ts
│       │   ├── cache.service.ts             # Wrapper Redis com invalidação inteligente
│       │   ├── cache.service.spec.ts
│       │   └── cache.interceptor.ts         # Interceptor de cache por rota
│       │
│       ├── media/
│       │   ├── media.module.ts
│       │   ├── media.controller.ts          # Upload de imagens
│       │   ├── media.service.ts             # Resize, otimização, upload para R2
│       │   ├── media.service.spec.ts
│       │   └── dto/ ...
│       │
│       ├── blog/
│       │   ├── blog.module.ts
│       │   ├── blog.controller.ts
│       │   ├── blog.service.ts
│       │   ├── blog.service.spec.ts
│       │   └── dto/ ...
│       │
│       ├── pages/
│       │   ├── pages.module.ts
│       │   ├── pages.controller.ts          # CRUD de páginas estáticas
│       │   ├── pages.service.ts
│       │   ├── pages.service.spec.ts
│       │   └── dto/ ...
│       │
│       └── admin/
│           ├── admin.module.ts
│           ├── dashboard.controller.ts      # Métricas e gráficos
│           ├── dashboard.service.ts
│           ├── dashboard.service.spec.ts
│           └── settings/
│               ├── settings.controller.ts   # Configurações gerais da loja
│               ├── settings.service.ts
│               └── settings.service.spec.ts
│
├── prisma/
│   ├── schema.prisma                  # Schema completo do banco
│   ├── migrations/                    # Migrations versionadas
│   └── seed.ts                        # Seed para dev (dados de exemplo)
│
├── test/
│   ├── jest.config.ts                 # Config Jest para unitários
│   ├── jest.integration.config.ts     # Config Jest para integração (usa banco real)
│   ├── jest.e2e.config.ts             # Config Jest para E2E
│   ├── setup/
│   │   ├── test-setup.ts              # Setup global (antes de todos os testes)
│   │   ├── integration-setup.ts       # Setup para integração (migra banco, limpa)
│   │   └── e2e-setup.ts              # Setup para E2E (sobe app completa)
│   ├── helpers/
│   │   ├── test-app.helper.ts         # Cria app NestJS para testes
│   │   ├── database.helper.ts         # Limpa/reseta banco entre testes
│   │   ├── auth.helper.ts             # Gera tokens JWT para testes
│   │   └── factory.helper.ts          # Factories para criar entidades de teste
│   └── fixtures/
│       ├── users.fixture.ts           # Dados de teste: usuários
│       ├── products.fixture.ts        # Dados de teste: produtos
│       ├── categories.fixture.ts      # Dados de teste: categorias
│       └── orders.fixture.ts          # Dados de teste: pedidos
│
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .env.example
├── .env.test                          # Variáveis para ambiente de teste
└── .eslintrc.js
```

---

## Frontend (Next.js)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Layout raiz (providers, fonts, metadata)
│   │   ├── page.tsx                        # Página inicial (/)
│   │   ├── not-found.tsx                   # Página 404
│   │   ├── error.tsx                       # Página de erro genérico
│   │   ├── globals.css                     # Tailwind base + custom CSS
│   │   │
│   │   ├── (public)/                       # Grupo de rotas públicas
│   │   │   ├── produto/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx            # Página do produto
│   │   │   ├── categoria/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx            # Listagem por categoria
│   │   │   ├── tag/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx            # Listagem por tag
│   │   │   ├── marca/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx            # Listagem por marca
│   │   │   ├── busca/
│   │   │   │   └── page.tsx                # Resultados de busca
│   │   │   ├── carrinho/
│   │   │   │   └── page.tsx                # Carrinho
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx                # Finalização de compra
│   │   │   ├── pedido/
│   │   │   │   └── confirmacao/
│   │   │   │       └── [id]/
│   │   │   │           └── page.tsx        # Agradecimento pós-compra
│   │   │   ├── rastreamento/
│   │   │   │   └── page.tsx                # Rastreamento público
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx                # Lista de posts
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx            # Post individual
│   │   │   ├── sobre/
│   │   │   │   └── page.tsx
│   │   │   ├── contato/
│   │   │   │   └── page.tsx
│   │   │   ├── faq/
│   │   │   │   └── page.tsx
│   │   │   ├── termos/
│   │   │   │   └── page.tsx
│   │   │   ├── privacidade/
│   │   │   │   └── page.tsx
│   │   │   └── trocas-e-devolucoes/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (auth)/                         # Grupo de rotas de autenticação
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── cadastro/
│   │   │   │   └── page.tsx
│   │   │   └── recuperar-senha/
│   │   │       └── page.tsx
│   │   │
│   │   ├── minha-conta/                    # Área autenticada do cliente
│   │   │   ├── layout.tsx                  # Layout com sidebar de navegação
│   │   │   ├── page.tsx                    # Dashboard do cliente
│   │   │   ├── pedidos/
│   │   │   │   ├── page.tsx                # Lista de pedidos
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx            # Detalhe do pedido + timeline
│   │   │   ├── dados/
│   │   │   │   └── page.tsx                # Dados pessoais
│   │   │   ├── enderecos/
│   │   │   │   └── page.tsx                # Endereços
│   │   │   └── lista-de-desejos/
│   │   │       └── page.tsx                # Wishlist
│   │   │
│   │   ├── admin/                          # Painel administrativo
│   │   │   ├── layout.tsx                  # Layout admin (sidebar, header)
│   │   │   ├── page.tsx                    # Dashboard
│   │   │   ├── produtos/
│   │   │   │   ├── page.tsx                # Lista de produtos
│   │   │   │   ├── novo/
│   │   │   │   │   └── page.tsx            # Criar produto
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx            # Editar produto
│   │   │   ├── categorias/
│   │   │   │   └── page.tsx
│   │   │   ├── tags/
│   │   │   │   └── page.tsx
│   │   │   ├── marcas/
│   │   │   │   └── page.tsx
│   │   │   ├── bundles/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── pedidos/
│   │   │   │   ├── page.tsx                # Lista com filtros por status
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx            # Detalhe + alterar status
│   │   │   ├── cupons/
│   │   │   │   └── page.tsx
│   │   │   ├── escalas/
│   │   │   │   └── page.tsx                # Regras de escala
│   │   │   ├── frete/
│   │   │   │   └── page.tsx                # Regras de frete grátis
│   │   │   ├── seo/
│   │   │   │   └── page.tsx
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── paginas/
│   │   │   │   └── page.tsx                # Edição de páginas estáticas
│   │   │   └── configuracoes/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/                            # Route handlers (se necessário)
│   │       └── revalidate/
│   │           └── route.ts                # Endpoint de revalidação ISR
│   │
│   ├── components/
│   │   ├── ui/                             # shadcn/ui (instalados via CLI)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── ...                         # Adicionar conforme necessidade
│   │   ├── layout/
│   │   │   ├── header.tsx                  # Header do site (nav, busca, carrinho)
│   │   │   ├── footer.tsx                  # Footer
│   │   │   ├── sidebar.tsx                 # Sidebar (filtros, admin)
│   │   │   ├── breadcrumb.tsx              # Breadcrumbs com schema.org
│   │   │   └── mobile-menu.tsx             # Menu mobile
│   │   ├── product/
│   │   │   ├── product-card.tsx            # Card de produto (listagens)
│   │   │   ├── product-gallery.tsx         # Galeria de imagens do produto
│   │   │   ├── scale-selector.tsx          # Seletor de escala
│   │   │   ├── variation-selector.tsx      # Seletor de variação
│   │   │   ├── price-display.tsx           # Exibição de preço (com desconto PIX)
│   │   │   ├── shipping-simulator.tsx      # Simulador de frete
│   │   │   └── add-to-cart-button.tsx      # Botão de adicionar ao carrinho
│   │   ├── cart/
│   │   │   ├── cart-item.tsx               # Item no carrinho
│   │   │   ├── cart-summary.tsx            # Resumo (subtotal, frete, desconto, total)
│   │   │   ├── cart-coupon.tsx             # Input de cupom
│   │   │   └── mini-cart.tsx               # Mini carrinho no header
│   │   ├── checkout/
│   │   │   ├── checkout-form.tsx           # Formulário completo
│   │   │   ├── address-form.tsx            # Formulário de endereço
│   │   │   ├── payment-selector.tsx        # Seleção de método de pagamento
│   │   │   └── order-summary.tsx           # Resumo final do pedido
│   │   ├── order/
│   │   │   ├── order-timeline.tsx          # Timeline visual de status
│   │   │   └── order-item.tsx              # Item do pedido
│   │   ├── search/
│   │   │   ├── search-bar.tsx              # Barra de busca com autocomplete
│   │   │   ├── search-filters.tsx          # Filtros laterais
│   │   │   └── search-results.tsx          # Grid de resultados
│   │   └── shared/
│   │       ├── pagination.tsx              # Paginação
│   │       ├── loading.tsx                 # Skeletons de loading
│   │       ├── empty-state.tsx             # Estado vazio (sem produtos, etc.)
│   │       ├── seo-head.tsx                # Meta tags dinâmicas
│   │       └── newsletter-form.tsx         # Formulário de newsletter
│   │
│   ├── hooks/
│   │   ├── use-cart.ts                     # Hook do carrinho
│   │   ├── use-auth.ts                     # Hook de autenticação
│   │   ├── use-shipping.ts                 # Hook de simulação de frete
│   │   ├── use-search.ts                   # Hook de busca com debounce
│   │   └── use-media-query.ts              # Hook de breakpoints responsivos
│   │
│   ├── lib/
│   │   ├── api-client.ts                   # Client HTTP para o backend
│   │   ├── auth.ts                         # Helpers de autenticação (cookies, refresh)
│   │   ├── utils.ts                        # Helpers genéricos (cn, formatCurrency, etc.)
│   │   ├── validators.ts                   # Zod schemas para formulários
│   │   └── constants.ts                    # Constantes (rotas, breakpoints, etc.)
│   │
│   ├── store/
│   │   ├── cart-store.ts                   # Zustand store para carrinho
│   │   ├── auth-store.ts                   # Zustand store para auth
│   │   └── ui-store.ts                     # Zustand store para UI (sidebar, modal)
│   │
│   └── types/
│       ├── product.ts                      # Tipos de produto, variação, escala
│       ├── cart.ts                         # Tipos do carrinho
│       ├── order.ts                        # Tipos de pedido, status
│       ├── user.ts                         # Tipos de usuário, endereço
│       └── api.ts                          # Tipos genéricos da API
│
├── public/
│   ├── robots.txt
│   └── favicon.ico
│
├── test/
│   ├── components/                         # Testes de componentes (Vitest + RTL)
│   │   ├── product-card.test.tsx
│   │   ├── scale-selector.test.tsx
│   │   ├── cart-summary.test.tsx
│   │   └── order-timeline.test.tsx
│   └── e2e/                                # Testes E2E (Playwright)
│       ├── playwright.config.ts
│       ├── home.spec.ts
│       ├── product-page.spec.ts
│       ├── cart-flow.spec.ts
│       ├── checkout-flow.spec.ts
│       └── admin-products.spec.ts
│
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── components.json                         # Config do shadcn/ui
└── .env.local.example
```

---

## Convenções do Projeto

### Nomenclatura

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Arquivos/pastas backend | kebab-case | `product-variations.service.ts` |
| Arquivos/pastas frontend | kebab-case | `product-card.tsx` |
| Classes | PascalCase | `ProductsService` |
| Interfaces | PascalCase com prefixo I (opcional) | `PaginatedResult` |
| Types | PascalCase | `ProductResponse` |
| Variáveis/funções | camelCase | `calculateBundlePrice` |
| Constantes | UPPER_SNAKE_CASE | `MAX_CART_ITEMS` |
| Banco (tabelas) | snake_case plural | `product_variations` |
| Banco (colunas) | snake_case | `created_at` |
| Rotas API | kebab-case plural | `/api/v1/scale-rules` |
| Slugs | kebab-case | `miniatura-guerreiro-28mm` |

### Estrutura de resposta da API

Toda resposta segue o formato:

```typescript
// Sucesso simples
{ data: T }

// Sucesso com paginação
{ data: T[], meta: { total: number, page: number, perPage: number, lastPage: number } }

// Erro
{ error: { statusCode: number, message: string, details?: any } }
```

### Versionamento de API

Todas as rotas são prefixadas com `/api/v1/`. Quando necessário, incrementar para `/api/v2/` mantendo retrocompatibilidade.

### Git

- **Branches:** `main` (produção), `develop` (desenvolvimento), `feature/*`, `fix/*`, `hotfix/*`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`)
- **PRs:** Sempre para `develop`. Merge para `main` via PR com aprovação.
