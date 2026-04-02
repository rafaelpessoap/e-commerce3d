# Plano de E-commerce — Miniaturas 3D (Pinups)

> **Versão:** 2.0 — 2 de abril de 2026
> **Objetivo:** Plataforma de e-commerce personalizada para venda de miniaturas 3D, começando com nicho de pinups como projeto-piloto. Após validação, migrar a loja Arsenal Craft (arsenalcraft.com.br) para a mesma plataforma.

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Versão | Justificativa |
|--------|-----------|--------|---------------|
| Runtime | **Node.js LTS** | 24.x | LTS mais recente (abril 2026) |
| Linguagem | **TypeScript** | 6.0 | Última versão estável |
| Backend API | **NestJS** | 11.1.x | Framework modular com DI nativa, ideal para TDD |
| Frontend | **Next.js (App Router)** | 16.2.x | SSR/ISR para SEO, 400% mais rápido no dev, Turbopack |
| UI Framework | **React** | 19.2.x | Server Components estáveis, Activity API |
| UI Components | **shadcn/ui + Tailwind CSS** | CLI v4 | Componentes copiados para o projeto, customização total, Radix UI |
| Banco de dados | **PostgreSQL** | 18.x | JSONB, full-text search, query planner superior |
| ORM | **Prisma** | 7.2.x | Type-safe, migrações versionadas, integração NestJS |
| Cache | **Redis** | Última | Cache de sessão, carrinho, queries, rate limiting |
| Busca | **Elasticsearch** | 9.3.x | Busca fuzzy, autocomplete, filtros por facetas |
| Fila de tarefas | **BullMQ** | 5.71.x | Processamento assíncrono sobre Redis |
| Servidor | **Ubuntu 24** | — | AMD Ryzen 5 2600, 32GB DDR4, NVMe 2TB |
| Containerização | **Docker + Docker Compose** | Última | Isolamento, deploy atômico, rollback |
| CI/CD | **GitHub Actions** | — | Testes, segurança, build, deploy |
| CDN/Proxy | **Cloudflare** | — | Cache, DDoS, SSL, CDN de imagens |
| Storage de Imagens | **Cloudflare R2** | — | S3-compatível, sem custo de egress, integra com CDN |
| Reverse Proxy | **Nginx** | Última | Proxy reverso no Docker |
| Email | **Nodemailer + React Email** | Última | SMTP próprio, templates em React |
| Testes Backend | **Jest** | Última | Testes unitários e integração NestJS |
| Testes Frontend | **Vitest + React Testing Library** | Última | Testes de componentes e hooks |
| Testes E2E | **Playwright** | Última | Testes de fluxo completo |

### Arquitetura Docker

```
docker-compose.yml
├── app-backend    (NestJS — porta 3001)
├── app-frontend   (Next.js — porta 3000)
├── nginx          (reverse proxy — portas 80/443)
└── (PostgreSQL, Redis, Elasticsearch rodam no host)
```

O backend e frontend rodam em containers. Banco, cache e busca acessam o host diretamente para máxima performance e aproveitamento dos serviços já existentes no servidor.

### Ambiente Local de Desenvolvimento (Docker Compose)

O desenvolvimento local roda 100% em Docker para garantir paridade com produção. Nenhuma dependência precisa estar instalada na máquina do desenvolvedor além de Docker e Node.js (para o editor).

```
docker-compose.dev.yml
├── app-backend         (NestJS — porta 3001, hot reload com volume mount)
├── app-frontend        (Next.js — porta 3000, hot reload com volume mount)
├── db-postgres         (PostgreSQL 18 — porta 5432)
├── db-redis            (Redis — porta 6379)
├── db-elasticsearch    (Elasticsearch 9.3 — porta 9200)
├── mailpit             (SMTP falso para emails — porta 8025 UI / 1025 SMTP)
└── nginx               (reverse proxy — porta 80)
```

**Mailpit** captura todos os emails enviados em dev, permitindo visualizar templates no navegador sem enviar emails reais.

Volumes nomeados persistem os dados entre restarts:
- `pg_data` — dados do PostgreSQL
- `es_data` — índices do Elasticsearch
- `redis_data` — dados do Redis

### Ambiente de Testes (Docker Compose)

O CI e testes locais usam um compose separado com serviços efêmeros:

```
docker-compose.test.yml
├── db-postgres-test    (PostgreSQL 18 — porta 5433, banco limpo)
├── db-redis-test       (Redis — porta 6380, flush entre testes)
├── db-elasticsearch-test (Elasticsearch 9.3 — porta 9201, índices limpos)
```

Os serviços de teste:
- Usam `tmpfs` para máxima velocidade (dados na memória, sem disco)
- Cada suite de testes recebe um banco limpo via migrations
- Redis é flushed entre suites
- Elasticsearch recria índices entre suites
- Portas diferentes para não conflitar com o ambiente dev

**Fluxo de testes local:**
```bash
# Subir serviços de teste
docker compose -f docker-compose.test.yml up -d

# Rodar testes backend
cd backend && npm run test        # unitários
cd backend && npm run test:int    # integração (usa banco real)
cd backend && npm run test:e2e    # E2E

# Rodar testes frontend
cd frontend && npm run test       # componentes
cd frontend && npm run test:e2e   # E2E com Playwright

# Derrubar tudo
docker compose -f docker-compose.test.yml down -v
```

### Ambiente de Produção (Docker Compose)

```
docker-compose.prod.yml
├── app-backend         (NestJS — build otimizado, multi-stage)
├── app-frontend        (Next.js — build estático + SSR)
├── nginx               (reverse proxy + SSL + cache headers)
└── (PostgreSQL, Redis, Elasticsearch no host do servidor)
```

Em produção, os containers usam multi-stage builds para imagens menores e mais seguras. O banco, Redis e Elasticsearch rodam no host para máxima performance.

### Estimativa de uso de memória

| Serviço | Alocação estimada |
|---------|-------------------|
| MariaDB (Arsenal Craft existente) | 2–4 GB |
| PostgreSQL (novo e-commerce) | 2–4 GB |
| Redis | 1–2 GB |
| Elasticsearch | 4–8 GB |
| WordPress + PHP-FPM (existente) | 2–4 GB |
| NestJS + Next.js (containers) | 1–2 GB |
| Sistema operacional | 1–2 GB |
| **Total estimado** | **~13–26 GB de 32 GB** |

---

## 2. Metodologia de Desenvolvimento

### TDD — Test-Driven Development (CORE do projeto)

O ciclo de desenvolvimento para TODA feature segue obrigatoriamente:

1. **RED** — Escrever o teste antes da implementação. O teste deve falhar.
2. **GREEN** — Implementar o código mínimo para o teste passar.
3. **REFACTOR** — Refatorar mantendo os testes verdes.

### Tipos de teste

| Tipo | Ferramenta | Escopo |
|------|-----------|--------|
| Unitário | Jest | Serviços, helpers, regras de negócio isoladas |
| Integração | Jest + Supertest | Controllers, endpoints, interação com banco |
| E2E | Playwright | Fluxos completos do usuário no frontend |
| Componente | Vitest + RTL | Componentes React isolados |

### Pipeline CI/CD (GitHub Actions)

```
push/PR → lint → type-check → unit tests → integration tests →
security scan → build → e2e tests → deploy (se branch main)
```

---

## 3. Páginas do Site

### Páginas públicas (acessíveis sem login)

| # | Página | Rota | Descrição |
|---|--------|------|-----------|
| 1 | **Página Inicial** | `/` | Banners, categorias em destaque, produtos populares, novidades, ofertas |
| 2 | **Página de Categoria** | `/categoria/:slug` | Lista de produtos filtrados por categoria, com paginação e filtros laterais |
| 3 | **Página de Tag** | `/tag/:slug` | Lista de produtos filtrados por tag |
| 4 | **Página de Marca** | `/marca/:slug` | Produtos de uma marca específica com descrição e banner da marca |
| 5 | **Página de Produto** | `/produto/:slug` | Detalhes do produto, variações, seleção de escala, simulação de frete, produtos relacionados |
| 6 | **Página de Busca** | `/busca?q=` | Resultados de busca com filtros, powered by Elasticsearch |
| 7 | **Carrinho** | `/carrinho` | Itens no carrinho, simulação de frete, cupom de desconto, resumo do pedido |
| 8 | **Finalização de Compra** | `/checkout` | Dados de entrega, seleção de frete, método de pagamento, resumo final |
| 9 | **Agradecimento Pós-Compra** | `/pedido/confirmacao/:id` | Confirmação do pedido, resumo, próximos passos, código de rastreamento futuro |
| 10 | **Blog** | `/blog` e `/blog/:slug` | Artigos para SEO: tutoriais de pintura, reviews, novidades do hobby |
| 11 | **Sobre Nós** | `/sobre` | História da marca, equipe, missão |
| 12 | **Contato** | `/contato` | Formulário de contato, informações de atendimento |
| 13 | **FAQ** | `/faq` | Perguntas frequentes organizadas por categoria |
| 14 | **Termos e Condições** | `/termos` | Termos de uso do site |
| 15 | **Política de Privacidade** | `/privacidade` | Conformidade com LGPD |
| 16 | **Política de Trocas e Devoluções** | `/trocas-e-devolucoes` | Regras de troca, prazo, condições |
| 17 | **Rastreamento de Pedido** | `/rastreamento` | Consulta pública por número do pedido + email (acesso via link do email) |
| 18 | **Página 404** | `/*` | Página personalizada para URLs não encontradas |

### Páginas autenticadas (requer login)

| # | Página | Rota | Descrição |
|---|--------|------|-----------|
| 19 | **Minha Conta — Dashboard** | `/minha-conta` | Visão geral: pedidos recentes, dados pessoais |
| 20 | **Minha Conta — Pedidos** | `/minha-conta/pedidos` | Histórico completo de pedidos |
| 21 | **Minha Conta — Detalhe do Pedido** | `/minha-conta/pedidos/:id` | Status de produção, itens, rastreamento, timeline visual |
| 22 | **Minha Conta — Dados Pessoais** | `/minha-conta/dados` | Edição de nome, email, senha |
| 23 | **Minha Conta — Endereços** | `/minha-conta/enderecos` | Gerenciamento de endereços de entrega |
| 24 | **Minha Conta — Lista de Desejos** | `/minha-conta/lista-de-desejos` | Produtos salvos para compra futura |
| 25 | **Login** | `/login` | Autenticação do usuário |
| 26 | **Cadastro** | `/cadastro` | Registro de novo usuário |
| 27 | **Recuperação de Senha** | `/recuperar-senha` | Reset de senha por email |

### Painel Administrativo

| # | Página | Descrição |
|---|--------|-----------|
| 28 | **Dashboard** | Métricas: vendas do dia/semana/mês, pedidos pendentes, produtos mais vendidos |
| 29 | **Produtos** | CRUD completo, variações, escalas, imagens, SEO por produto |
| 30 | **Categorias** | CRUD com hierarquia, imagem, descrição, regras de escala |
| 31 | **Tags** | CRUD com regras de escala |
| 32 | **Marcas** | CRUD com logo, banner, descrição |
| 33 | **Bundles / Kits** | Criação de kits com produtos-filhos, desconto automático |
| 34 | **Pedidos** | Lista com filtros por status, busca, detalhes, alteração de status (com disparo de email) |
| 35 | **Clientes** | Lista de clientes, histórico de compras |
| 36 | **Cupons** | CRUD: tipo (% ou fixo), validade, uso mínimo, limite de uso, categorias/produtos específicos |
| 37 | **Regras de Frete Grátis** | Configuração por faixa de CEP + valor mínimo de compra |
| 38 | **Regras de Escala** | Configuração global, por categoria, por tag, por produto (com prioridade) |
| 39 | **Status de Pedido** | CRUD de status customizados + templates de email por status |
| 40 | **SEO** | Configuração de meta tags, Open Graph, Schema.org por página/produto |
| 41 | **Configurações** | Dados da loja, integrações (Mercado Pago, Melhor Envio), emails, cache |
| 42 | **Blog** | CRUD de posts |
| 43 | **Páginas estáticas** | Edição de conteúdo das páginas institucionais |

---

## 4. Funcionalidades Core

### 4.1 Sistema de Pagamento — Mercado Pago

**Integração:** API do Mercado Pago (Checkout Pro ou Checkout Transparente)

**Métodos suportados:**
- Cartão de crédito (parcelado)
- Cartão de débito
- PIX
- Boleto bancário

**Descontos por método de pagamento:**
- Configurável no admin (ex: 10% de desconto no PIX)
- Aplicado automaticamente no checkout ao selecionar o método
- Exibido na página do produto como "R$ X no PIX"

**Fluxo:**
1. Cliente finaliza compra → cria preference no Mercado Pago
2. Webhook do Mercado Pago notifica status do pagamento
3. Sistema atualiza status do pedido automaticamente
4. Email de confirmação enviado ao cliente

### 4.2 Sistema de Frete — Melhor Envio

**Integração:** API do Melhor Envio

**Funcionalidades:**
- Simulação de frete na página do produto (por CEP)
- Simulação de frete no carrinho (com todos os itens)
- Múltiplas transportadoras (Correios, Jadlog, etc.)
- Geração automática de etiqueta após envio
- Rastreamento integrado

**Frete grátis condicional:**
- Configurável por faixa de CEP + valor mínimo de compra
- Exemplo: CEPs 01000-000 a 09999-999 → frete grátis acima de R$ 150
- Múltiplas regras podem coexistir
- Exibido no carrinho: "Faltam R$ X para frete grátis!"

### 4.3 Sistema de Escalas de Miniatura

Este é o diferencial principal da plataforma. Miniaturas podem ser vendidas em diferentes escalas (28mm, 32mm, 54mm, 75mm, etc.), e cada escala tem um multiplicador de preço.

**Hierarquia de prioridade (maior para menor):**
1. **Produto individual** — regra específica para aquele produto
2. **Tag** — regra aplicada a todos os produtos com aquela tag
3. **Categoria** — regra aplicada a todos os produtos da categoria

**Estrutura de dados:**

```
ScaleRule {
  id
  name              // ex: "28mm", "32mm", "75mm"
  priceModifier     // tipo: fixed_add, percentage, fixed_price
  modifierValue     // valor numérico
  scope             // product, tag, category
  scopeId           // ID do produto/tag/categoria (null = global)
  isDefault         // se é a escala padrão
  sortOrder         // ordem de exibição
}
```

**Comportamento no frontend:**
- Página do produto exibe seletor de escala
- Preço atualiza em tempo real ao trocar a escala
- Se o produto tem variações, cada variação pode ter escalas
- Escala selecionada aparece no carrinho e no pedido

### 4.4 Bundles / Kits de Produtos

**Conceito:** Kit é um produto composto por N outros produtos, com preço calculado automaticamente a partir dos componentes.

**Estrutura:**

```
ProductBundle {
  id
  name
  slug
  description
  discount          // tipo: percentage, fixed
  discountValue     // ex: 15 (= 15% de desconto no total dos componentes)
  components: [
    { productId, variationId?, quantity, scaleRuleId? }
  ]
}
```

**Comportamento:**
- Preço do kit = soma dos preços dos componentes × (1 - desconto)
- Quando o preço de um componente muda, o preço do kit atualiza automaticamente
- Estoque do kit = menor estoque entre os componentes
- Admin pode visualizar preview do preço calculado ao montar o kit

### 4.5 Fluxo de Produção dos Pedidos (State Machine)

**Estados padrão (configuráveis no admin):**

```
Pagamento Pendente → Pagamento Aprovado → Em Fila de Produção →
Produzindo → Em Separação → Enviado → Entregue
```

**Estados adicionais possíveis:**
- Pagamento Recusado
- Cancelado
- Reembolsado
- Devolvido

**Cada transição de estado:**
1. Registra timestamp e usuário que alterou
2. Dispara email personalizado ao cliente (template configurável por estado)
3. Atualiza timeline visual na página do pedido (minha conta)
4. Registra no log de auditoria

**Na página "Minha Conta > Pedido":**
- Timeline visual mostrando todos os estados
- Estado atual destacado
- Previsão de prazo por estado (ex: "Produção: 3 dias úteis")
- Link de rastreamento quando disponível (estado "Enviado")

### 4.6 Sistema de Cupons

**Tipos de cupom:**
- Porcentagem de desconto
- Valor fixo de desconto
- Frete grátis

**Restrições configuráveis:**
- Valor mínimo do pedido
- Categorias/produtos específicos
- Limite de uso total
- Limite de uso por cliente
- Data de validade (início e fim)
- Primeira compra apenas

### 4.7 SEO (estilo RankMath)

**Por produto/página:**
- Meta title (com contador de caracteres)
- Meta description (com contador)
- Slug customizável
- Open Graph (título, descrição, imagem)
- Schema.org (Product, BreadcrumbList, Organization, etc.)
- Canonical URL
- Robots meta (index/noindex, follow/nofollow)

**Global:**
- Geração automática de sitemap.xml (produtos, categorias, tags, marcas, blog)
- Robots.txt configurável
- Redirecionamentos 301 (útil na migração do Arsenal Craft)
- Breadcrumbs estruturados
- URLs amigáveis e consistentes

**Análise SEO (inspirada no RankMath):**
- Checklist por produto: título tem palavra-chave? Descrição tem tamanho adequado? Imagens tem alt text?
- Score visual (verde/amarelo/vermelho)

### 4.8 Sistema de Cache

**Camadas:**

| Camada | Tecnologia | O que cacheia | TTL |
|--------|-----------|---------------|-----|
| CDN | Cloudflare | Assets estáticos (CSS, JS, imagens) | 30 dias |
| Página | Next.js ISR | Páginas de produto, categoria, tag | Revalidação sob demanda |
| API | Redis | Respostas de API frequentes (listagens, filtros) | 5–15 min |
| Query | Redis | Queries complexas ao PostgreSQL | 5 min |
| Sessão | Redis | Sessão do usuário, carrinho | 7 dias |

**Invalidação:**
- Ao atualizar produto no admin → invalida cache da página do produto + categorias relacionadas
- Ao alterar preço → invalida cache de bundles que contêm o produto
- Webhook do Cloudflare API para purge de páginas específicas

### 4.9 Elasticsearch — Busca Inteligente

**Indexação:**
- Todos os produtos com: nome, descrição, SKU, categoria, tags, marca, atributos
- Atualização via fila BullMQ quando produto é criado/editado

**Funcionalidades:**
- Busca fuzzy (tolerância a erros de digitação)
- Autocomplete (sugestões enquanto digita)
- Filtros por facetas: categoria, marca, tag, faixa de preço, escala
- Ordenação: relevância, preço, novidade, popularidade
- Sinônimos configuráveis

### 4.10 Emails Transacionais

**Templates por evento:**

| Evento | Email | Destinatário |
|--------|-------|-------------|
| Cadastro | Boas-vindas | Cliente |
| Pedido criado | Confirmação do pedido | Cliente |
| Pagamento aprovado | Pagamento confirmado | Cliente |
| Em fila de produção | Produção iniciada | Cliente |
| Produzindo | Miniaturas sendo produzidas | Cliente |
| Em separação | Pedido sendo preparado para envio | Cliente |
| Enviado | Pedido enviado + código de rastreamento | Cliente |
| Entregue | Pedido entregue + convite para avaliar | Cliente |
| Pagamento recusado | Problema no pagamento | Cliente |
| Cancelamento | Pedido cancelado | Cliente |
| Novo pedido | Notificação de venda | Admin |
| Estoque baixo | Alerta de estoque | Admin |

**Processamento:** Via fila BullMQ para não bloquear a request.

### 4.11 Produtos Variáveis

**Estrutura:**

```
Product {
  id, name, slug, description, sku, ...
  type: "simple" | "variable" | "bundle"
  variations: [
    {
      id, sku, price, salePrice, stock,
      attributes: { color: "Red", material: "Resin" },
      images: [...],
      weight, dimensions
    }
  ]
}
```

**Comportamento no frontend:**
- Seletores de atributos (dropdown ou visual)
- Preço e imagem atualizam ao selecionar variação
- Estoque verificado por variação
- Cada variação pode ter escalas diferentes (via ScaleRule por produto)

---

## 5. Modelagem do Banco de Dados (Visão Geral)

### Entidades principais

```
users
  ├── addresses
  ├── wishlists
  └── orders
        ├── order_items
        ├── order_status_history
        └── order_shipments

products
  ├── product_variations
  ├── product_images
  ├── product_categories (many-to-many)
  ├── product_tags (many-to-many)
  └── product_bundles
        └── bundle_items

categories (hierárquica — parent_id)
tags
brands

scale_rules (scope: global/category/tag/product)

coupons
  └── coupon_usage

shipping_free_rules (faixa de CEP + valor mínimo)

seo_metadata (polimórfica — product/category/tag/page)

email_templates (vinculadas a order_status)

order_statuses (configuráveis)

blog_posts
  └── blog_categories

static_pages

site_settings (key-value)
```

### Índices críticos para performance

- `products`: índice composto em `(status, category_id, created_at)` para listagens
- `product_variations`: índice em `(product_id, stock > 0)` para disponibilidade
- `scale_rules`: índice em `(scope, scope_id)` para lookup rápido da hierarquia
- `orders`: índice em `(user_id, status, created_at)` para "meus pedidos"
- `order_status_history`: índice em `(order_id, created_at)` para timeline

---

## 6. Estrutura do Projeto

```
miniatures-ecommerce/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint, type-check, testes
│       ├── security.yml        # Análise de segurança
│       └── deploy.yml          # Build e deploy
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx/
│       └── nginx.conf
├── backend/                     # NestJS
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/            # Autenticação e autorização
│   │   │   ├── users/           # Gestão de usuários
│   │   │   ├── products/        # Produtos, variações, imagens
│   │   │   ├── categories/      # Categorias hierárquicas
│   │   │   ├── tags/            # Tags
│   │   │   ├── brands/          # Marcas
│   │   │   ├── scales/          # Regras de escala
│   │   │   ├── bundles/         # Kits de produtos
│   │   │   ├── cart/            # Carrinho de compras
│   │   │   ├── orders/          # Pedidos e status
│   │   │   ├── payments/        # Integração Mercado Pago
│   │   │   ├── shipping/        # Integração Melhor Envio + frete grátis
│   │   │   ├── coupons/         # Sistema de cupons
│   │   │   ├── search/          # Integração Elasticsearch
│   │   │   ├── seo/             # Meta tags, sitemap, schema.org
│   │   │   ├── email/           # Templates e envio de emails
│   │   │   ├── cache/           # Gerenciamento de cache Redis
│   │   │   ├── media/           # Upload e gestão de imagens
│   │   │   ├── blog/            # Posts do blog
│   │   │   ├── pages/           # Páginas estáticas editáveis
│   │   │   └── admin/           # Dashboard e configurações admin
│   │   ├── common/              # Guards, interceptors, decorators, pipes
│   │   ├── config/              # Configurações centralizadas
│   │   ├── database/            # Prisma schema, migrations, seeds
│   │   └── main.ts
│   ├── test/
│   │   ├── unit/                # Testes unitários (espelha src/modules/)
│   │   ├── integration/         # Testes de integração
│   │   └── fixtures/            # Dados de teste
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/                    # Next.js
│   ├── src/
│   │   ├── app/                 # App Router (páginas)
│   │   │   ├── (public)/        # Grupo: páginas públicas
│   │   │   ├── (auth)/          # Grupo: login, cadastro
│   │   │   ├── minha-conta/     # Área do cliente
│   │   │   ├── admin/           # Painel administrativo
│   │   │   └── api/             # Route handlers (se necessário)
│   │   ├── components/          # Componentes reutilizáveis
│   │   │   ├── ui/              # Componentes base (Button, Input, Modal)
│   │   │   ├── product/         # ProductCard, ProductGallery, ScaleSelector
│   │   │   ├── cart/            # CartItem, CartSummary
│   │   │   ├── checkout/        # CheckoutForm, PaymentSelector
│   │   │   ├── layout/          # Header, Footer, Sidebar
│   │   │   └── shared/          # Breadcrumb, Pagination, SearchBar
│   │   ├── hooks/               # Custom hooks
│   │   ├── lib/                 # Utilitários, API client, helpers
│   │   ├── store/               # Estado global (Zustand ou Context)
│   │   └── types/               # TypeScript types/interfaces
│   ├── public/                  # Assets estáticos
│   ├── test/
│   │   ├── components/          # Testes de componentes
│   │   └── e2e/                 # Testes E2E (Playwright)
│   ├── package.json
│   └── next.config.js
└── docs/                        # Documentação do projeto
    ├── api/                     # Documentação da API
    ├── architecture/            # Decisões de arquitetura (ADRs)
    └── setup/                   # Guias de setup
```

---

## 7. Fases de Implementação

### Fase 1 — Fundação (Semanas 1–3)

**Objetivo:** Infraestrutura base funcionando com TDD.

1. Setup do repositório, Docker, CI/CD básico
2. Configuração do NestJS com Prisma + PostgreSQL
3. Configuração do Next.js com App Router
4. Módulo de autenticação (registro, login, JWT, refresh token)
5. CRUD de usuários e endereços
6. Testes unitários e de integração para tudo acima

### Fase 2 — Catálogo (Semanas 4–6)

**Objetivo:** Produtos cadastrados e navegáveis.

1. CRUD de categorias (hierárquicas)
2. CRUD de tags
3. CRUD de marcas
4. CRUD de produtos (simples e variáveis)
5. Sistema de imagens (upload, resize, otimização)
6. Sistema de escalas (regras por categoria/tag/produto)
7. Integração com Elasticsearch (indexação e busca)
8. Páginas: produto, categoria, tag, marca, busca
9. Página inicial

### Fase 3 — Compra (Semanas 7–9)

**Objetivo:** Fluxo de compra completo funcionando.

1. Carrinho de compras (Redis-backed)
2. Sistema de cupons
3. Integração com Melhor Envio (simulação + contratação)
4. Regras de frete grátis
5. Integração com Mercado Pago (pagamento + webhook)
6. Descontos por método de pagamento
7. Checkout completo
8. Página de agradecimento
9. Bundles / Kits de produtos

### Fase 4 — Pós-venda (Semanas 10–11)

**Objetivo:** Gestão de pedidos e comunicação com cliente.

1. State machine de pedidos (status customizáveis)
2. Painel de gestão de pedidos (admin)
3. Timeline visual de status (minha conta)
4. Sistema de emails transacionais (templates por status)
5. Página de rastreamento público
6. Área "Minha Conta" completa (pedidos, dados, endereços, wishlist)

### Fase 5 — SEO e Performance (Semanas 12–13)

**Objetivo:** Site otimizado para busca e velocidade.

1. Sistema de SEO (meta tags, Open Graph, Schema.org)
2. Geração de sitemap.xml
3. Configuração de cache Redis (queries, API)
4. Configuração do Cloudflare (cache, CDN)
5. Next.js ISR para páginas de produto/categoria
6. Otimização de imagens (WebP, lazy loading, srcset)
7. Blog (CRUD + páginas)

### Fase 6 — Admin e Polish (Semanas 14–16)

**Objetivo:** Painel administrativo completo e refinamentos.

1. Dashboard admin (métricas, gráficos)
2. Configurações do site
3. Edição de páginas estáticas
4. Redirecionamentos 301
5. Página 404 personalizada
6. Testes E2E completos (Playwright)
7. Testes de carga (k6 ou Artillery)
8. Auditoria de segurança
9. Documentação da API

---

## 8. Decisões Arquiteturais Pendentes

| Decisão | Resultado | Status |
|---------|----------|--------|
| ~~Linguagem do backend~~ | NestJS 11 (TypeScript 6) | **Decidido** |
| ~~Banco de dados~~ | PostgreSQL 18 (existente no servidor) | **Decidido** |
| ~~Docker~~ | Docker para tudo (dev, test, prod) | **Decidido** |
| ~~Biblioteca de UI~~ | shadcn/ui CLI v4 + Tailwind CSS | **Decidido** |
| ~~Serviço de email~~ | SMTP próprio + Nodemailer + React Email | **Decidido** |
| ~~Armazenamento de imagens~~ | Cloudflare R2 | **Decidido** |
| ~~Go para funções pesadas~~ | Não por enquanto, reavaliar após migração Arsenal Craft | **Decidido** |
| Gerenciamento de estado (frontend) | Zustand vs React Context vs Jotai | A definir durante Fase 2 |
| Admin panel | Custom vs AdminJS vs Refine | A definir durante Fase 6 |
| Nome do projeto / domínio | Placeholder: `miniatures-store` | A definir |

---

## 9. Considerações para Migração Futura (Arsenal Craft)

Quando o projeto-piloto de pinups estiver validado, a migração do Arsenal Craft envolverá:

1. **Script de migração WooCommerce → PostgreSQL** — produtos, categorias, pedidos, clientes
2. **Redirecionamentos 301** — mapear todas as URLs antigas para as novas
3. **Migração de imagens** — download do WordPress e upload para o novo storage
4. **Migração de atributos** — converter os 12k+ atributos do WooCommerce para o novo schema
5. **Período de transição** — rodar ambos os sites em paralelo com redirect gradual
6. **Se necessário:** extração de serviços pesados para Go (busca, cálculos em lote)

A arquitetura modular do NestJS facilita essa migração futura — os módulos são independentes e testáveis isoladamente.
