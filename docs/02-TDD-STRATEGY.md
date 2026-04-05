# 02 — Estratégia de TDD e Testes

> Este é o documento mais importante do projeto. TDD é o CORE do desenvolvimento.
> **NENHUMA funcionalidade é implementada antes do teste existir.**
> Este documento define regras, padrões, exemplos e checklists para garantir isso.

---

## Filosofia: Red → Green → Refactor

Cada feature segue obrigatoriamente este ciclo:

```
1. RED    → Escreva o teste. Ele DEVE falhar. Rode e confirme que falha.
2. GREEN  → Escreva o MÍNIMO de código para o teste passar. Nada além.
3. REFACTOR → Melhore o código mantendo todos os testes verdes.
4. REPITA → Próximo caso de teste.
```

### Regras invioláveis

1. **Teste primeiro, SEMPRE.** Não existe "vou escrever o teste depois". Se o teste não existe, a feature não pode ser implementada.
2. **Um teste de cada vez.** Não escreva 10 testes e depois implemente tudo. Escreva 1 teste, faça passar, escreva o próximo.
3. **Rode os testes a cada mudança.** Antes de commitar, todos os testes DEVEM estar verdes.
4. **Testes são cidadãos de primeira classe.** Código de teste recebe a mesma atenção que código de produção: nomes claros, sem duplicação, organizado.
5. **Nenhum PR é aceito com testes falhando.** O CI bloqueia merge se qualquer teste falha.
6. **Cobertura mínima: 80%.** O CI falha se a cobertura de testes cair abaixo de 80%. Meta: 90%+.
7. **Testes de segurança são obrigatórios.** Cada módulo DEVE incluir testes que validam proteção contra ataques. Ver `08-SECURITY.md` para os padrões e checklists por fase. Segurança não é uma fase — é integrada desde o primeiro teste.

---

## Pirâmide de Testes

```
        ╱ E2E ╲               ← Poucos (~10-15% dos testes)
       ╱--------╲                Fluxos completos do usuário
      ╱Integração╲            ← Médio (~25-30% dos testes)
     ╱────────────╲              Módulos com banco/Redis/ES real
    ╱  Unitários    ╲          ← Muitos (~55-65% dos testes)
   ╱──────────────────╲          Serviços e funções isoladas
```

### Quando usar cada tipo

| Tipo | Usa banco real? | Usa Redis real? | Usa APIs externas? | Velocidade |
|------|:-:|:-:|:-:|:-:|
| Unitário | Não (mock) | Não (mock) | Não (mock) | Muito rápido (~ms) |
| Integração | Sim (teste DB) | Sim (teste Redis) | Não (mock) | Médio (~100ms) |
| E2E | Sim | Sim | Mock/sandbox | Lento (~1-5s) |

---

## Configuração de Testes — Backend (NestJS + Jest)

### Estrutura de configs

```
backend/
├── jest.config.ts                    # Base config
├── test/
│   ├── jest.unit.config.ts           # Extends base — só unitários
│   ├── jest.integration.config.ts    # Extends base — usa banco real
│   └── jest.e2e.config.ts            # Extends base — sobe app inteira
```

### Scripts no package.json

```json
{
  "scripts": {
    "test": "jest --config test/jest.unit.config.ts",
    "test:watch": "jest --config test/jest.unit.config.ts --watch",
    "test:int": "jest --config test/jest.integration.config.ts --runInBand",
    "test:e2e": "jest --config test/jest.e2e.config.ts --runInBand",
    "test:cov": "jest --config test/jest.unit.config.ts --coverage",
    "test:all": "npm run test && npm run test:int && npm run test:e2e",
    "test:ci": "npm run test:cov && npm run test:int -- --coverage && npm run test:e2e"
  }
}
```

**`--runInBand`**: Testes de integração e E2E rodam sequencialmente (não em paralelo) porque compartilham o banco.

### Config base (jest.config.ts)

```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
```

---

## Padrões de Teste — Unitários (Backend)

### Regra de nomenclatura

```typescript
describe('NomeDoService', () => {
  describe('nomeDoMetodo', () => {
    it('deve [ação esperada] quando [condição]', () => {
      // ...
    });
  });
});
```

### Template: Service com dependências mockadas

```typescript
// scales.service.spec.ts — ESCREVER ANTES de scales.service.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ScalesService } from './scales.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('ScalesService', () => {
  let service: ScalesService;
  let prisma: jest.Mocked<PrismaService>;

  // Arrange global — mock do Prisma
  const mockPrisma = {
    scaleRule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScalesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ScalesService>(ScalesService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ============================================
  // resolveScalePrice — O MÉTODO MAIS CRÍTICO
  // ============================================
  describe('resolveScalePrice', () => {

    // TESTE 1: Regra individual do produto tem prioridade máxima
    it('deve usar regra do produto quando existe regra individual', async () => {
      // Arrange
      const productId = 'prod-1';
      const scaleId = 'scale-28mm';
      const basePrice = 100;

      mockPrisma.scaleRule.findMany.mockResolvedValue([
        { id: '1', scope: 'product', scopeId: productId, scaleId, priceModifier: 'percentage', modifierValue: 50 },
        { id: '2', scope: 'category', scopeId: 'cat-1', scaleId, priceModifier: 'percentage', modifierValue: 30 },
      ]);

      // Act
      const result = await service.resolveScalePrice(productId, scaleId, basePrice);

      // Assert
      expect(result).toBe(150); // 100 + 50% = 150 (usa regra do produto, não categoria)
    });

    // TESTE 2: Fallback para tag quando não tem regra individual
    it('deve usar regra da tag quando não existe regra individual do produto', async () => {
      // Arrange
      const productId = 'prod-1';
      const scaleId = 'scale-75mm';
      const basePrice = 100;

      // Não existe regra para o produto, apenas para a tag
      mockPrisma.scaleRule.findMany.mockResolvedValue([
        { id: '2', scope: 'tag', scopeId: 'tag-1', scaleId, priceModifier: 'fixed_add', modifierValue: 80 },
        { id: '3', scope: 'category', scopeId: 'cat-1', scaleId, priceModifier: 'percentage', modifierValue: 30 },
      ]);

      // Act
      const result = await service.resolveScalePrice(productId, scaleId, basePrice);

      // Assert
      expect(result).toBe(180); // 100 + 80 fixo = 180 (usa regra da tag)
    });

    // TESTE 3: Fallback para categoria
    it('deve usar regra da categoria quando não existe regra de produto nem tag', async () => {
      // ... arrange/act/assert
    });

    // TESTE 4: Sem regra = preço base
    it('deve retornar preço base quando não existe nenhuma regra para a escala', async () => {
      // ...
    });

    // TESTE 5: Preço fixo override
    it('deve usar preço fixo quando o modifier é fixed_price', async () => {
      // ...
    });
  });
});
```

### Template: Controller spec

```typescript
// products.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<ProductsService>;

  const mockService = {
    findAll: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get(ProductsService);
    jest.clearAllMocks();
  });

  describe('GET /products/:slug', () => {
    it('deve retornar produto quando slug existe', async () => {
      const product = { id: '1', name: 'Miniatura Guerreiro', slug: 'miniatura-guerreiro' };
      mockService.findBySlug.mockResolvedValue(product);

      const result = await controller.findBySlug('miniatura-guerreiro');

      expect(result).toEqual({ data: product });
      expect(mockService.findBySlug).toHaveBeenCalledWith('miniatura-guerreiro');
    });

    it('deve lançar NotFoundException quando slug não existe', async () => {
      mockService.findBySlug.mockResolvedValue(null);

      await expect(controller.findBySlug('nao-existe'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## Padrões de Teste — Integração (Backend)

Testes de integração usam banco PostgreSQL real (do docker-compose.test.yml).

### Setup de integração

```typescript
// test/setup/integration-setup.ts

import { execSync } from 'child_process';

// Roda antes de TODOS os testes de integração
export default async function setup() {
  // Aplica migrations no banco de teste
  execSync('npx prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  });
}
```

### Helper: Limpar banco entre testes

```typescript
// test/helpers/database.helper.ts

import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Limpa TODAS as tabelas do banco de teste.
 * Chamar no afterEach ou beforeEach dos testes de integração.
 * Usa TRUNCATE CASCADE para limpar tudo de uma vez.
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename != '_prisma_migrations'
  `;

  for (const { tablename } of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
  }
}
```

### Helper: Factories para dados de teste

```typescript
// test/helpers/factory.helper.ts

import { PrismaService } from '@/common/prisma/prisma.service';
import { faker } from '@faker-js/faker/locale/pt_BR';

export class TestFactory {
  constructor(private prisma: PrismaService) {}

  async createUser(overrides: Partial<CreateUserDto> = {}) {
    return this.prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: await hash('Test@123', 10),
        ...overrides,
      },
    });
  }

  async createProduct(overrides: Partial<CreateProductDto> = {}) {
    const category = overrides.categoryId
      ? undefined
      : await this.createCategory();

    return this.prisma.product.create({
      data: {
        name: faker.commerce.productName(),
        slug: faker.helpers.slugify(faker.commerce.productName()).toLowerCase(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
        stock: faker.number.int({ min: 0, max: 100 }),
        status: 'active',
        categoryId: category?.id,
        ...overrides,
      },
    });
  }

  async createCategory(overrides = {}) {
    return this.prisma.category.create({
      data: {
        name: faker.commerce.department(),
        slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
        ...overrides,
      },
    });
  }

  async createOrder(userId: string, items: { productId: string; quantity: number }[]) {
    // Cria pedido completo com items
    return this.prisma.order.create({
      data: {
        userId,
        status: 'pending_payment',
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: 0, // Será calculado pelo service
          })),
        },
      },
      include: { items: true },
    });
  }
}
```

### Template: Teste de integração

```typescript
// orders.service.integration.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '@/modules/orders/orders.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { cleanDatabase } from '@test/helpers/database.helper';
import { TestFactory } from '@test/helpers/factory.helper';

describe('OrdersService (Integration)', () => {
  let service: OrdersService;
  let prisma: PrismaService;
  let factory: TestFactory;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // Importa módulos reais, não mocks
      imports: [OrdersModule, PrismaModule],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
    factory = new TestFactory(prisma);
  });

  // Limpa banco antes de cada teste = isolamento total
  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('createOrder', () => {
    it('deve criar pedido com status pending_payment e calcular total', async () => {
      // Arrange — dados reais no banco
      const user = await factory.createUser();
      const product1 = await factory.createProduct({ price: 50 });
      const product2 = await factory.createProduct({ price: 30 });

      // Act
      const order = await service.createOrder(user.id, {
        items: [
          { productId: product1.id, quantity: 2 },
          { productId: product2.id, quantity: 1 },
        ],
        addressId: '...',
      });

      // Assert
      expect(order.status).toBe('pending_payment');
      expect(order.total).toBe(130); // (50 × 2) + (30 × 1)
      expect(order.items).toHaveLength(2);

      // Verifica no banco que foi realmente persistido
      const savedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });
      expect(savedOrder).not.toBeNull();
      expect(savedOrder!.items).toHaveLength(2);
    });

    it('deve lançar erro quando produto não tem estoque suficiente', async () => {
      const user = await factory.createUser();
      const product = await factory.createProduct({ price: 50, stock: 1 });

      await expect(
        service.createOrder(user.id, {
          items: [{ productId: product.id, quantity: 5 }],
          addressId: '...',
        }),
      ).rejects.toThrow('Estoque insuficiente');
    });
  });

  describe('updateOrderStatus (state machine)', () => {
    it('deve transicionar de pending_payment para payment_approved', async () => {
      const user = await factory.createUser();
      const product = await factory.createProduct();
      const order = await factory.createOrder(user.id, [
        { productId: product.id, quantity: 1 },
      ]);

      const updated = await service.updateStatus(order.id, 'payment_approved');

      expect(updated.status).toBe('payment_approved');

      // Verifica que o histórico foi registrado
      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId: order.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0].fromStatus).toBe('pending_payment');
      expect(history[0].toStatus).toBe('payment_approved');
    });

    it('deve rejeitar transição inválida (pending_payment → shipped)', async () => {
      const user = await factory.createUser();
      const product = await factory.createProduct();
      const order = await factory.createOrder(user.id, [
        { productId: product.id, quantity: 1 },
      ]);

      await expect(
        service.updateStatus(order.id, 'shipped'),
      ).rejects.toThrow('Transição de status inválida');
    });
  });
});
```

---

## Padrões de Teste — Frontend (Vitest + React Testing Library)

### Config (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

### Template: Teste de componente

```typescript
// test/components/scale-selector.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScaleSelector } from '@/components/product/scale-selector';

describe('ScaleSelector', () => {
  const mockScales = [
    { id: '1', name: '28mm', price: 25.00 },
    { id: '2', name: '32mm', price: 30.00 },
    { id: '3', name: '75mm', price: 85.00 },
  ];

  it('deve renderizar todas as escalas disponíveis', () => {
    render(<ScaleSelector scales={mockScales} onSelect={vi.fn()} />);

    expect(screen.getByText('28mm')).toBeInTheDocument();
    expect(screen.getByText('32mm')).toBeInTheDocument();
    expect(screen.getByText('75mm')).toBeInTheDocument();
  });

  it('deve exibir preço formatado em BRL para cada escala', () => {
    render(<ScaleSelector scales={mockScales} onSelect={vi.fn()} />);

    expect(screen.getByText('R$ 25,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 85,00')).toBeInTheDocument();
  });

  it('deve chamar onSelect com a escala correta ao clicar', () => {
    const onSelect = vi.fn();
    render(<ScaleSelector scales={mockScales} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('75mm'));

    expect(onSelect).toHaveBeenCalledWith(mockScales[2]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('deve destacar visualmente a escala selecionada', () => {
    render(
      <ScaleSelector scales={mockScales} selectedId="2" onSelect={vi.fn()} />
    );

    const selected = screen.getByText('32mm').closest('button');
    expect(selected).toHaveClass('selected'); // ou data-selected, depende da implementação
  });

  it('deve mostrar escala padrão pré-selecionada', () => {
    const scalesWithDefault = mockScales.map(s => ({
      ...s,
      isDefault: s.id === '1',
    }));

    render(<ScaleSelector scales={scalesWithDefault} onSelect={vi.fn()} />);

    const defaultScale = screen.getByText('28mm').closest('button');
    expect(defaultScale).toHaveAttribute('aria-selected', 'true');
  });
});
```

### Template: Teste de hook

```typescript
// test/hooks/use-cart.test.ts

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCart } from '@/hooks/use-cart';

// Mock do API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve iniciar com carrinho vazio', () => {
    const { result } = renderHook(() => useCart());

    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });

  it('deve adicionar item ao carrinho', async () => {
    const { result } = renderHook(() => useCart());

    await act(async () => {
      await result.current.addItem({
        productId: 'prod-1',
        quantity: 2,
        scaleId: 'scale-28mm',
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('deve incrementar quantidade se item já existe no carrinho', async () => {
    const { result } = renderHook(() => useCart());

    await act(async () => {
      await result.current.addItem({ productId: 'prod-1', quantity: 1, scaleId: 'scale-28mm' });
      await result.current.addItem({ productId: 'prod-1', quantity: 2, scaleId: 'scale-28mm' });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
  });

  it('deve tratar mesmo produto com escalas diferentes como itens separados', async () => {
    const { result } = renderHook(() => useCart());

    await act(async () => {
      await result.current.addItem({ productId: 'prod-1', quantity: 1, scaleId: 'scale-28mm' });
      await result.current.addItem({ productId: 'prod-1', quantity: 1, scaleId: 'scale-75mm' });
    });

    expect(result.current.items).toHaveLength(2); // São itens diferentes!
  });
});
```

---

## Padrões de Teste — E2E (Playwright)

### Template: Fluxo de compra completo

```typescript
// test/e2e/checkout-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Fluxo de Compra', () => {

  test('deve completar compra de miniatura com escala 32mm via PIX', async ({ page }) => {
    // 1. Navegar para produto
    await page.goto('/produto/guerreiro-medieval');
    await expect(page.locator('h1')).toContainText('Guerreiro Medieval');

    // 2. Selecionar escala
    await page.click('button:has-text("32mm")');
    await expect(page.locator('[data-testid="price"]')).toContainText('R$');

    // 3. Adicionar ao carrinho
    await page.click('button:has-text("Adicionar ao Carrinho")');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    // 4. Ir ao carrinho
    await page.click('[data-testid="cart-icon"]');
    await expect(page).toHaveURL('/carrinho');
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

    // 5. Simular frete
    await page.fill('[data-testid="cep-input"]', '01001-000');
    await page.click('button:has-text("Calcular Frete")');
    await expect(page.locator('[data-testid="shipping-options"]')).toBeVisible();

    // 6. Ir ao checkout
    await page.click('button:has-text("Finalizar Compra")');
    await expect(page).toHaveURL('/checkout');

    // 7. Preencher dados (se não logado, faz login)
    // ...

    // 8. Selecionar PIX
    await page.click('[data-testid="payment-pix"]');
    await expect(page.locator('[data-testid="pix-discount"]')).toBeVisible();

    // 9. Confirmar pedido
    await page.click('button:has-text("Confirmar Pedido")');

    // 10. Verificar página de agradecimento
    await expect(page).toHaveURL(/\/pedido\/confirmacao\//);
    await expect(page.locator('h1')).toContainText('Pedido Confirmado');
  });
});
```

---

## Regra de Ouro — Testes de Precificação (OBRIGATÓRIO)

> **Qualquer código que influencie o valor final de um produto ou pedido DEVE ter testes no `PricingService`. Sem exceção.**

### O que influencia o preço

Tudo abaixo passa pelo `PricingService.calculateOrderPricing()`:

- Preço base do produto (`basePrice`, `salePrice`)
- Preço de variação (`variation.price`, `variation.salePrice`)
- Incremento de escala (`ScaleRuleItem.percentageIncrease`)
- Cupom de desconto (PERCENTAGE, FIXED, FREE_SHIPPING)
- Restrição de cupom por categoria/tag
- Desconto por método de pagamento (PIX, Boleto)
- Valor do frete
- Frete grátis (por cupom ou regra de valor mínimo)
- **Qualquer regra futura** que altere subtotal, desconto ou total

### Checklist obrigatório ao criar/alterar regra de preço

1. [ ] Existe teste unitário da regra isolada no `describe` correspondente de `pricing.service.spec.ts`
2. [ ] Existe teste de combinação no `describe('combinações — CHECKOUT COMPLETO')` que inclui a nova regra junto com as existentes
3. [ ] O `PricingService.calculateOrderPricing()` chama a nova regra (não pode ficar "solta" no código)
4. [ ] O teste de combinação verifica o `total` final com todos os fatores aplicados (escala + cupom + frete + pagamento)
5. [ ] Se a regra tem restrições (ex: cupom por categoria), existe teste que valida a rejeição quando a restrição não é atendida

### Como adicionar uma regra de preço nova

```
1. Criar método privado no PricingService (ex: applyLoyaltyDiscount())
2. Adicionar describe('loyalty discount') no spec com testes da regra isolada
3. Adicionar caso no describe('combinações — CHECKOUT COMPLETO') combinando a regra nova com as existentes
4. Chamar o método em calculateOrderPricing() na posição correta da sequência
5. Se o teste de combinação NÃO incluir a nova regra → PR DEVE SER REJEITADO
```

### O guardião final

O `describe('combinações — CHECKOUT COMPLETO')` em `pricing.service.spec.ts` simula o fluxo real do checkout com TODAS as regras ativas. Se uma regra nova não aparece nesse bloco, ela não foi integrada ao fluxo de finalização e o pedido será calculado incorretamente.

### Estrutura de testes do PricingService

```
pricing.service.spec.ts
  describe('preço base')         → basePrice, salePrice, variation
  describe('escala')             → percentageIncrease, prioridade, noScales
  describe('cupom')              → PERCENTAGE, FIXED, FREE_SHIPPING, restrições
  describe('desconto pagamento') → PIX 10%, Boleto 5%, CC 0%
  describe('combinações')        → CHECKOUT COMPLETO — todas as regras juntas
```

---

## Checklist por Módulo — O que testar

### Auth
- [ ] Registro com dados válidos cria usuário
- [ ] Registro com email duplicado retorna erro
- [ ] Registro com senha fraca retorna erro (mínimo 8 chars, 1 maiúscula, 1 número)
- [ ] Login com credenciais válidas retorna JWT + refresh token
- [ ] Login com senha errada retorna 401
- [ ] Login com email inexistente retorna 401
- [ ] Refresh token gera novo JWT válido
- [ ] Refresh token expirado retorna 401
- [ ] Rotas protegidas sem token retornam 401
- [ ] Rotas admin com usuário não-admin retornam 403

### Products
- [ ] Criar produto simples com dados válidos
- [ ] Criar produto variável com variações
- [ ] Listar produtos com paginação
- [ ] Filtrar produtos por categoria, tag, marca, faixa de preço
- [ ] Buscar produto por slug
- [ ] Atualizar produto
- [ ] Soft delete de produto
- [ ] Produto com estoque 0 aparece como "indisponível"
- [ ] Slug é gerado automaticamente e é único

### Scales (CRÍTICO)
- [ ] Regra individual do produto tem prioridade sobre tag e categoria
- [ ] Regra de tag tem prioridade sobre categoria
- [ ] Regra de categoria é usada como fallback
- [ ] Sem regra = retorna preço base inalterado
- [ ] Modifier `percentage` calcula corretamente (base + %)
- [ ] Modifier `fixed_add` soma valor ao preço base
- [ ] Modifier `fixed_price` substitui o preço base
- [ ] Escalas múltiplas para o mesmo produto retornam lista ordenada
- [ ] Admin pode criar/editar/deletar regras por escopo

### Bundles (CRÍTICO)
- [ ] Preço do bundle = soma dos componentes × (1 - desconto)
- [ ] Alterar preço de um componente recalcula preço do bundle
- [ ] Estoque do bundle = menor estoque entre componentes
- [ ] Bundle com componente sem estoque fica indisponível
- [ ] Desconto percentual calcula corretamente
- [ ] Desconto fixo calcula corretamente
- [ ] Bundle com escala calcula preço dos componentes na escala

### Orders / State Machine (CRÍTICO)
- [ ] Status inicial é `PENDING`
- [ ] Transições válidas: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
- [ ] Transições inválidas são rejeitadas
- [ ] Cada transição registra histórico com timestamp
- [ ] Cada transição dispara job de email na fila
- [ ] Cancelamento restaura estoque dos produtos
- [ ] createOrder delega cálculo ao PricingService

### Orders / Pricing — CHECKOUT (CRÍTICO — ver PricingService acima)
- [ ] Preço base recalculado do banco (ignora frontend)
- [ ] Variação usa salePrice quando existe
- [ ] Escala aplica percentageIncrease correto
- [ ] Escala respeita prioridade (produto > tag > categoria)
- [ ] Escala com noScales=true não aplica incremento
- [ ] Cupom PERCENTAGE desconta % do subtotal
- [ ] Cupom FIXED desconta valor limitado ao subtotal
- [ ] Cupom FREE_SHIPPING zera o frete
- [ ] Cupom com restrição de categoria rejeita itens fora
- [ ] Cupom com restrição de tag rejeita itens fora
- [ ] Desconto PIX = 10% do subtotal (NÃO do total)
- [ ] Desconto Boleto = 5% do subtotal
- [ ] Desconto NUNCA aplicado sobre frete
- [ ] Total = subtotal - cupomDesconto + frete
- [ ] Total nunca negativo
- [ ] Mesmo produto com escalas diferentes = linhas separadas
- [ ] Combinação completa: variação + escala + cupom + PIX = valor correto

### Payments
- [ ] Criar preference no Mercado Pago com dados corretos
- [ ] Webhook approved atualiza pedido para payment_approved
- [ ] Webhook rejected atualiza pedido para payment_rejected
- [ ] Webhook com assinatura inválida é rejeitado (segurança)
- [ ] Desconto por método de pagamento é aplicado (ex: PIX)
- [ ] Idempotência: webhook duplicado não processa duas vezes

### Shipping
- [ ] Simulação de frete retorna opções de transportadoras
- [ ] Frete grátis é aplicado quando valor ≥ mínimo E CEP está na faixa
- [ ] Frete grátis NÃO é aplicado quando valor < mínimo
- [ ] Frete grátis NÃO é aplicado quando CEP está fora da faixa
- [ ] Múltiplas regras de frete grátis: a primeira que match é aplicada
- [ ] Cálculo com múltiplos itens soma os pesos

### Coupons
- [ ] Cupom percentual calcula desconto correto
- [ ] Cupom valor fixo calcula desconto correto
- [ ] Cupom expirado é rejeitado
- [ ] Cupom com limite de uso atingido é rejeitado
- [ ] Cupom com valor mínimo: aplica se total ≥ mínimo
- [ ] Cupom por categoria: só desconta produtos da categoria
- [ ] Cupom de primeira compra: rejeita se usuário já comprou

### Cart
- [ ] Adicionar item ao carrinho
- [ ] Remover item do carrinho
- [ ] Atualizar quantidade
- [ ] Mesmo produto + mesma escala = incrementa quantidade
- [ ] Mesmo produto + escala diferente = item separado
- [ ] Carrinho persiste no Redis entre requests
- [ ] Carrinho expira após 7 dias sem atividade
- [ ] Aplicar cupom no carrinho recalcula total
- [ ] Simular frete no carrinho com todos os itens

### Search
- [ ] Busca por nome retorna produtos relevantes
- [ ] Busca fuzzy tolera erros de digitação
- [ ] Autocomplete retorna sugestões em <200ms
- [ ] Filtros por categoria, marca, tag funcionam
- [ ] Filtro por faixa de preço funciona
- [ ] Ordenação por relevância, preço, novidade
- [ ] Produto inativo não aparece nos resultados
- [ ] Reindexação ao atualizar produto

### SEGURANÇA (obrigatório em CADA módulo — ver 08-SECURITY.md)
- [ ] **Auth:** Senha nunca retornada em response
- [ ] **Auth:** Mensagem genérica em login falho (não revelar se email existe)
- [ ] **Auth:** Registro SEMPRE cria CUSTOMER (role não aceita no DTO)
- [ ] **Auth:** Rate limiting no login (5 tentativas/min → 429)
- [ ] **Auth:** Refresh token rotation com detecção de roubo
- [ ] **DTOs:** Campos extras são rejeitados (`forbidNonWhitelisted: true`)
- [ ] **DTOs:** Cada campo tem validação (tipo, tamanho, formato)
- [ ] **IDOR:** Usuário A não acessa pedido do usuário B → 403
- [ ] **IDOR:** Usuário A não acessa endereço do usuário B → 403
- [ ] **IDOR:** Usuário A não acessa wishlist do usuário B → 403
- [ ] **Roles:** CUSTOMER não acessa rotas admin → 403
- [ ] **Preços:** Backend calcula preço, ignora qualquer preço vindo do frontend
- [ ] **Descontos:** Backend calcula desconto, ignora qualquer desconto vindo do frontend
- [ ] **Frete:** Backend calcula frete, ignora qualquer frete vindo do frontend
- [ ] **Webhook:** Assinatura do Mercado Pago verificada em toda notificação
- [ ] **Webhook:** Idempotência — não processa payment_id duplicado
- [ ] **Webhook:** Double-check — consulta Mercado Pago para confirmar status
- [ ] **Webhook:** Valor do pagamento deve bater com total do pedido
- [ ] **Upload:** Extensão + MIME type real validados (whitelist)
- [ ] **Upload:** Nome de arquivo aleatório (nunca usar nome original)
- [ ] **Upload:** Tamanho máximo validado (10MB)
- [ ] **XSS:** HTML em descriptions sanitizado (DOMPurify)
- [ ] **SQLi:** Nenhum uso de `$queryRawUnsafe` com input do usuário
- [ ] **Audit:** Ações de escrita logadas com userId, IP, timestamp

---

## Regras do CI (GitHub Actions)

```yaml
# Testes bloqueiam merge se:
# 1. Qualquer teste falha
# 2. Cobertura abaixo de 80%
# 3. Lint errors
# 4. Type errors
# 5. Vulnerabilidades de segurança (npm audit)
```

O CI roda na seguinte ordem:

1. **Lint + TypeCheck** (paralelo, rápido)
2. **Testes unitários + cobertura** (paralelo backend/frontend)
3. **Testes de integração** (sequencial, precisa do banco)
4. **Testes E2E** (sequencial, precisa de tudo rodando)
5. **Security scan** (paralelo)

Se qualquer step falha, o pipeline para e o PR não pode ser mergeado.

---

## Fluxo de Desenvolvimento (Passo a Passo)

Para cada nova feature, siga exatamente este fluxo:

```
1. Crie uma branch: git checkout -b feature/nome-da-feature
2. Escreva o(s) teste(s) unitário(s) do service
3. Rode: npm run test -- --watch (deve FALHAR — RED)
4. Implemente o service (mínimo para passar)
5. Rode testes (deve PASSAR — GREEN)
6. Refatore se necessário (testes continuam verdes — REFACTOR)
7. Escreva testes do controller
8. Implemente o controller
9. Escreva teste de integração (se aplicável)
10. Confirme que todos passam: npm run test:all
11. Commit: git commit -m "feat: descrição"
12. Push + abra PR para develop
13. CI roda todos os testes
14. Code review + merge
```
