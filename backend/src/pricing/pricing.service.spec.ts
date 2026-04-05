import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentsService } from '../payments/payments.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: any;
  let scalesService: any;
  let couponsService: any;
  let paymentsService: any;

  const mockProduct = {
    id: 'prod1',
    name: 'Guerreira Elfica',
    basePrice: 49.9,
    salePrice: null,
    isActive: true,
    type: 'variable',
    categoryId: 'cat1',
    tags: [{ id: 'tag1' }],
    variations: [
      { id: 'var1', name: 'Modelo A', price: 49.9, salePrice: null },
      { id: 'var2', name: 'Modelo B', price: 79, salePrice: 69 },
    ],
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
      },
    };
    scalesService = {
      resolveScaleRule: jest.fn(),
      calculateScalePrice: jest.fn(),
    };
    couponsService = {
      validate: jest.fn(),
    };
    paymentsService = {
      calculateMethodDiscount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ScalesService, useValue: scalesService },
        { provide: CouponsService, useValue: couponsService },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  // ═══════════════════════════════════════════════════════
  // PREÇO BASE — busca no banco, ignora frontend
  // ═══════════════════════════════════════════════════════

  describe('preço base', () => {
    it('deve usar product.basePrice para produto simples', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
      });
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
      });

      expect(result.items[0].basePrice).toBe(100);
      expect(result.items[0].unitPrice).toBe(100);
      expect(result.subtotal).toBe(100);
    });

    it('deve usar product.salePrice quando existe', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        salePrice: 80,
      });
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 0,
      });

      expect(result.items[0].basePrice).toBe(80);
    });

    it('deve usar variation.price quando variationId fornecido', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var1', quantity: 2 }],
        shippingAmount: 0,
      });

      expect(result.items[0].basePrice).toBe(49.9);
      expect(result.items[0].lineTotal).toBe(99.8);
    });

    it('deve usar variation.salePrice sobre variation.price', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var2', quantity: 1 }],
        shippingAmount: 0,
      });

      expect(result.items[0].basePrice).toBe(69); // salePrice, not 79
    });

    it('deve lançar erro em produto inativo', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          shippingAmount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro em produto inexistente', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'nonexistent', quantity: 1 }],
          shippingAmount: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar erro em variação inexistente', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', variationId: 'nonexistent', quantity: 1 }],
          shippingAmount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════
  // ESCALA — aplica percentageIncrease do ScaleRuleItem
  // ═══════════════════════════════════════════════════════

  describe('escala', () => {
    it('deve aplicar percentageIncrease quando scaleId fornecido', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
          { id: 'item2', name: '75mm', percentageIncrease: 150, sortOrder: 1 },
        ],
      });
      scalesService.calculateScalePrice.mockReturnValue(124.75);
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var1', scaleId: 'item2', quantity: 1 }],
        shippingAmount: 0,
      });

      expect(result.items[0].scalePercentage).toBe(150);
      expect(result.items[0].unitPrice).toBe(124.75);
      expect(scalesService.calculateScalePrice).toHaveBeenCalledWith(49.9, 150);
    });

    it('deve usar escala base (0%) sem alterar preço', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [{ id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 }],
      });
      scalesService.calculateScalePrice.mockReturnValue(49.9);
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var1', scaleId: 'item1', quantity: 1 }],
        shippingAmount: 0,
      });

      expect(result.items[0].scalePercentage).toBe(0);
      expect(result.items[0].unitPrice).toBe(49.9);
    });

    it('deve ignorar escala quando produto tem noScales (resolveScaleRule retorna null)', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue(null);
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var1', scaleId: 'item1', quantity: 1 }],
        shippingAmount: 0,
      });

      // Sem regra de escala, usa preço base sem incremento
      expect(result.items[0].scalePercentage).toBe(0);
      expect(result.items[0].unitPrice).toBe(49.9);
    });

    it('deve lançar erro quando scaleId não existe na regra do produto', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [{ id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 }],
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', variationId: 'var1', scaleId: 'nonexistent', quantity: 1 }],
          shippingAmount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('não deve aplicar escala quando scaleId omitido', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var1', quantity: 1 }],
        shippingAmount: 0,
      });

      expect(result.items[0].scalePercentage).toBe(0);
      expect(scalesService.resolveScaleRule).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════
  // CUPOM — desconto PERCENTAGE, FIXED, FREE_SHIPPING
  // ═══════════════════════════════════════════════════════

  describe('cupom', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
      });
      paymentsService.calculateMethodDiscount.mockReturnValue(0);
    });

    it('deve aplicar desconto PERCENTAGE no subtotal', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 10,
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCode: 'DESCONTO10',
        shippingAmount: 15,
      });

      expect(result.couponDiscount).toBe(10);
      expect(result.total).toBe(105); // 100 - 10 + 15
    });

    it('deve aplicar desconto FIXED limitado ao subtotal', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 100,
        type: 'FIXED',
        couponId: 'c2',
        categoryId: null,
        tagId: null,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCode: 'FIXO100',
        shippingAmount: 15,
      });

      expect(result.couponDiscount).toBe(100); // capped at subtotal by CouponsService
      expect(result.total).toBe(15); // 100 - 100 + 15
    });

    it('deve aplicar FREE_SHIPPING zerando frete', async () => {
      couponsService.validate.mockResolvedValue({
        discount: 0,
        type: 'FREE_SHIPPING',
        couponId: 'c3',
        categoryId: null,
        tagId: null,
      });

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCode: 'FRETEGRATIS',
        shippingAmount: 25,
      });

      expect(result.isFreeShipping).toBe(true);
      expect(result.shipping).toBe(0);
      expect(result.total).toBe(100); // 100 - 0 + 0
    });

    it('deve rejeitar cupom quando nenhum item pertence à categoria restrita', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        categoryId: 'cat-other', // diferente da restrição
        tags: [],
      });
      couponsService.validate.mockResolvedValue({
        discount: 10,
        type: 'PERCENTAGE',
        couponId: 'c4',
        categoryId: 'cat-restricted',
        tagId: null,
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          couponCode: 'CATDESC',
          shippingAmount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar cupom quando nenhum item tem a tag restrita', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 100,
        tags: [{ id: 'tag-other' }],
      });
      couponsService.validate.mockResolvedValue({
        discount: 10,
        type: 'PERCENTAGE',
        couponId: 'c5',
        categoryId: null,
        tagId: 'tag-restricted',
      });

      await expect(
        service.calculateOrderPricing({
          userId: 'u1',
          items: [{ productId: 'prod1', quantity: 1 }],
          couponCode: 'TAGDESC',
          shippingAmount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('não deve aplicar cupom quando couponCode não fornecido', async () => {
      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 10,
      });

      expect(result.couponDiscount).toBe(0);
      expect(result.couponId).toBeUndefined();
      expect(couponsService.validate).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════
  // DESCONTO POR MÉTODO DE PAGAMENTO
  // ═══════════════════════════════════════════════════════

  describe('desconto pagamento', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 200,
      });
    });

    it('deve calcular 10% PIX sobre subtotal', async () => {
      paymentsService.calculateMethodDiscount.mockReturnValue(20);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 15,
        paymentMethod: 'pix',
      });

      expect(result.paymentDiscount).toBe(20);
      expect(paymentsService.calculateMethodDiscount).toHaveBeenCalledWith('pix', 200);
      // total NÃO inclui paymentDiscount (fica no Payment)
      expect(result.total).toBe(215); // 200 + 15
    });

    it('deve calcular 5% Boleto sobre subtotal', async () => {
      paymentsService.calculateMethodDiscount.mockReturnValue(10);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 15,
        paymentMethod: 'boleto',
      });

      expect(result.paymentDiscount).toBe(10);
    });

    it('deve calcular 0% para credit_card', async () => {
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        shippingAmount: 15,
        paymentMethod: 'credit_card',
      });

      expect(result.paymentDiscount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // COMBINAÇÕES — CHECKOUT COMPLETO (guardião final)
  // ═══════════════════════════════════════════════════════

  describe('combinações — CHECKOUT COMPLETO', () => {
    it('variação + escala 75mm (+150%) + cupom 10% + PIX', async () => {
      // Variação var1 = R$49.90, escala 75mm = +150% → R$124.75
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        categoryId: 'cat1',
        tags: [{ id: 'tag1' }],
      });
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [{ id: 'item2', name: '75mm', percentageIncrease: 150, sortOrder: 1 }],
      });
      scalesService.calculateScalePrice.mockReturnValue(124.75);
      couponsService.validate.mockResolvedValue({
        discount: 12.48, // 10% de 124.75 arredondado
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockReturnValue(12.48); // 10% de 124.75

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', variationId: 'var1', scaleId: 'item2', quantity: 1 }],
        couponCode: 'DESCONTO10',
        shippingAmount: 18.5,
        paymentMethod: 'pix',
      });

      expect(result.items[0].basePrice).toBe(49.9);
      expect(result.items[0].scalePercentage).toBe(150);
      expect(result.items[0].unitPrice).toBe(124.75);
      expect(result.subtotal).toBe(124.75);
      expect(result.couponDiscount).toBe(12.48);
      expect(result.shipping).toBe(18.5);
      expect(result.paymentDiscount).toBe(12.48);
      // total = subtotal - coupon + shipping = 124.75 - 12.48 + 18.50 = 130.77
      expect(result.total).toBe(130.77);
    });

    it('produto simples + sem escala + cupom fixo R$20 + boleto', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 89.9,
        salePrice: null,
      });
      couponsService.validate.mockResolvedValue({
        discount: 20,
        type: 'FIXED',
        couponId: 'c2',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockReturnValue(4.5); // 5% de 89.9

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCode: 'FIXO20',
        shippingAmount: 12,
        paymentMethod: 'boleto',
      });

      expect(result.subtotal).toBe(89.9);
      expect(result.couponDiscount).toBe(20);
      expect(result.paymentDiscount).toBe(4.5);
      // total = 89.9 - 20 + 12 = 81.9
      expect(result.total).toBe(81.9);
    });

    it('mesmo produto 2x com escalas diferentes = linhas separadas', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      scalesService.resolveScaleRule.mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
          { id: 'item2', name: '75mm', percentageIncrease: 150, sortOrder: 1 },
        ],
      });
      scalesService.calculateScalePrice
        .mockReturnValueOnce(49.9) // 28mm base
        .mockReturnValueOnce(124.75); // 75mm +150%
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          { productId: 'prod1', variationId: 'var1', scaleId: 'item1', quantity: 1 },
          { productId: 'prod1', variationId: 'var1', scaleId: 'item2', quantity: 1 },
        ],
        shippingAmount: 0,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].unitPrice).toBe(49.9);
      expect(result.items[1].unitPrice).toBe(124.75);
      expect(result.subtotal).toBe(174.65);
    });

    it('total nunca negativo (cupom maior que subtotal)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 10,
      });
      couponsService.validate.mockResolvedValue({
        discount: 10,
        type: 'FIXED',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCode: 'FIXO10',
        shippingAmount: 0,
      });

      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('frete grátis + desconto PIX', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        type: 'simple',
        basePrice: 200,
      });
      couponsService.validate.mockResolvedValue({
        discount: 0,
        type: 'FREE_SHIPPING',
        couponId: 'c3',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockReturnValue(20);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCode: 'FRETEGRATIS',
        shippingAmount: 25,
        paymentMethod: 'pix',
      });

      expect(result.isFreeShipping).toBe(true);
      expect(result.shipping).toBe(0);
      expect(result.paymentDiscount).toBe(20);
      expect(result.total).toBe(200); // 200 - 0 + 0
    });

    it('múltiplos itens com quantidades + cupom + frete', async () => {
      // 2 produtos: A (R$50 x2) + B salePrice (R$69 x1)
      prisma.product.findUnique
        .mockResolvedValueOnce({
          ...mockProduct,
          type: 'simple',
          basePrice: 50,
          salePrice: null,
        })
        .mockResolvedValueOnce({
          ...mockProduct,
          id: 'prod2',
          type: 'simple',
          basePrice: 80,
          salePrice: 69,
        });
      couponsService.validate.mockResolvedValue({
        discount: 16.9, // 10% de 169
        type: 'PERCENTAGE',
        couponId: 'c1',
        categoryId: null,
        tagId: null,
      });
      paymentsService.calculateMethodDiscount.mockReturnValue(0);

      const result = await service.calculateOrderPricing({
        userId: 'u1',
        items: [
          { productId: 'prod1', quantity: 2 },
          { productId: 'prod2', quantity: 1 },
        ],
        couponCode: 'DESC10',
        shippingAmount: 20,
      });

      expect(result.subtotal).toBe(169); // 50*2 + 69
      expect(result.couponDiscount).toBe(16.9);
      // total = 169 - 16.9 + 20 = 172.1
      expect(result.total).toBe(172.1);
    });
  });
});
