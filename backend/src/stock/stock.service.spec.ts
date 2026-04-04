import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StockService', () => {
  let service: StockService;

  // Mocks
  const mockProduct = {
    id: 'prod-1',
    name: 'Miniatura Dragon',
    manageStock: true,
    stock: 10,
    reservedStock: 0,
    lowStockThreshold: null,
    type: 'simple',
  };

  const mockVariation = {
    id: 'var-1',
    productId: 'prod-1',
    stock: 5,
    reservedStock: 0,
    product: { ...mockProduct, type: 'variable', manageStock: true },
  };

  const mockProductUpdate = jest.fn();
  const mockVariationUpdate = jest.fn();
  const mockProductFindUnique = jest.fn();
  const mockVariationFindUnique = jest.fn();
  const mockAuditCreate = jest.fn();
  const mockAuditFindMany = jest.fn().mockResolvedValue([]);
  const mockAuditDeleteMany = jest.fn();
  const mockOrderFindUnique = jest.fn();
  const mockOrderUpdate = jest.fn();
  const mockOrderItemFindMany = jest.fn();
  const mockSettingFindUnique = jest.fn().mockResolvedValue(null);
  const mockTransaction = jest.fn((cb) =>
    cb({
      product: { findUnique: mockProductFindUnique, update: mockProductUpdate },
      productVariation: {
        findUnique: mockVariationFindUnique,
        update: mockVariationUpdate,
      },
      stockAuditLog: {
        create: mockAuditCreate,
        findMany: mockAuditFindMany,
        deleteMany: mockAuditDeleteMany,
      },
      order: { findUnique: mockOrderFindUnique, update: mockOrderUpdate },
      orderItem: { findMany: mockOrderItemFindMany },
      setting: { findUnique: mockSettingFindUnique },
      $queryRawUnsafe: jest.fn(),
    }),
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: mockTransaction,
            stockAuditLog: {
              findMany: mockAuditFindMany,
            },
            setting: {
              findUnique: mockSettingFindUnique,
            },
          },
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    jest.clearAllMocks();
  });

  // ─── RESERVE ────────────────────────────────────────────────

  describe('reserveStock', () => {
    it('should reserve stock for simple product', async () => {
      mockProductFindUnique.mockResolvedValue(mockProduct);
      mockProductUpdate.mockResolvedValue({});
      mockAuditCreate.mockResolvedValue({});
      mockOrderUpdate.mockResolvedValue({});

      await service.reserveStock('order-1', [
        { productId: 'prod-1', quantity: 3 },
      ]);

      expect(mockProductUpdate).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { reservedStock: { increment: 3 } },
      });
      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          delta: 0,
          reason: 'ORDER_RESERVED',
          referenceId: 'order-1',
        }),
      });
    });

    it('should reserve stock for variation', async () => {
      mockProductFindUnique.mockResolvedValue({
        ...mockProduct,
        type: 'variable',
      });
      mockVariationFindUnique.mockResolvedValue(mockVariation);
      mockVariationUpdate.mockResolvedValue({});
      mockAuditCreate.mockResolvedValue({});
      mockOrderUpdate.mockResolvedValue({});

      await service.reserveStock('order-1', [
        { productId: 'prod-1', variationId: 'var-1', quantity: 2 },
      ]);

      expect(mockVariationUpdate).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { reservedStock: { increment: 2 } },
      });
    });

    it('should throw when insufficient stock for simple product', async () => {
      mockProductFindUnique.mockResolvedValue({
        ...mockProduct,
        stock: 2,
        reservedStock: 0,
      });

      await expect(
        service.reserveStock('order-1', [
          { productId: 'prod-1', quantity: 5 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when insufficient stock considering reserved', async () => {
      mockProductFindUnique.mockResolvedValue({
        ...mockProduct,
        stock: 10,
        reservedStock: 8,
      });

      await expect(
        service.reserveStock('order-1', [
          { productId: 'prod-1', quantity: 5 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip reservation when manageStock is false', async () => {
      mockProductFindUnique.mockResolvedValue({
        ...mockProduct,
        manageStock: false,
      });
      mockOrderUpdate.mockResolvedValue({});

      await service.reserveStock('order-1', [
        { productId: 'prod-1', quantity: 100 },
      ]);

      expect(mockProductUpdate).not.toHaveBeenCalled();
      expect(mockAuditCreate).not.toHaveBeenCalled();
    });
  });

  // ─── CONFIRM ────────────────────────────────────────────────

  describe('confirmReservation', () => {
    it('should decrement stock and reservedStock on confirmation', async () => {
      mockOrderFindUnique.mockResolvedValue({
        id: 'order-1',
        stockReserved: true,
      });
      mockOrderItemFindMany.mockResolvedValue([
        {
          productId: 'prod-1',
          variationId: null,
          quantity: 3,
          product: mockProduct,
        },
      ]);
      mockProductFindUnique.mockResolvedValue({
        ...mockProduct,
        reservedStock: 3,
      });
      mockProductUpdate.mockResolvedValue({});
      mockAuditCreate.mockResolvedValue({});
      mockOrderUpdate.mockResolvedValue({});

      await service.confirmReservation('order-1');

      expect(mockProductUpdate).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: {
          stock: { decrement: 3 },
          reservedStock: { decrement: 3 },
        },
      });
    });

    it('should be idempotent — skip if stockReserved is false', async () => {
      mockOrderFindUnique.mockResolvedValue({
        id: 'order-1',
        stockReserved: false,
      });

      await service.confirmReservation('order-1');

      expect(mockOrderItemFindMany).not.toHaveBeenCalled();
      expect(mockProductUpdate).not.toHaveBeenCalled();
    });
  });

  // ─── RELEASE ────────────────────────────────────────────────

  describe('releaseStock', () => {
    it('should release reservedStock on cancellation', async () => {
      mockOrderFindUnique.mockResolvedValue({
        id: 'order-1',
        stockReserved: true,
      });
      mockOrderItemFindMany.mockResolvedValue([
        {
          productId: 'prod-1',
          variationId: null,
          quantity: 3,
          product: mockProduct,
        },
      ]);
      mockProductFindUnique.mockResolvedValue({
        ...mockProduct,
        reservedStock: 3,
      });
      mockProductUpdate.mockResolvedValue({});
      mockAuditCreate.mockResolvedValue({});
      mockOrderUpdate.mockResolvedValue({});

      await service.releaseStock('order-1', 'ORDER_CANCELLED');

      expect(mockProductUpdate).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { reservedStock: { decrement: 3 } },
      });
    });

    it('should be idempotent — skip if stockReserved is false', async () => {
      mockOrderFindUnique.mockResolvedValue({
        id: 'order-1',
        stockReserved: false,
      });

      await service.releaseStock('order-1', 'ORDER_CANCELLED');

      expect(mockProductUpdate).not.toHaveBeenCalled();
    });
  });

  // ─── ADJUST ─────────────────────────────────────────────────

  describe('adjustStock', () => {
    it('should adjust stock and create audit log', async () => {
      mockProductFindUnique.mockResolvedValue(mockProduct);
      mockProductUpdate.mockResolvedValue({
        ...mockProduct,
        stock: 15,
      });
      mockAuditCreate.mockResolvedValue({});

      await service.adjustStock({
        productId: 'prod-1',
        delta: 5,
        adminUserId: 'admin-1',
      });

      expect(mockProductUpdate).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stock: { increment: 5 } },
      });
      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          delta: 5,
          reason: 'ADMIN_ADJUSTMENT',
          referenceId: 'admin-1',
        }),
      });
    });

    it('should adjust variation stock when variationId provided', async () => {
      mockVariationFindUnique.mockResolvedValue(mockVariation);
      mockVariationUpdate.mockResolvedValue({
        ...mockVariation,
        stock: 8,
      });
      mockAuditCreate.mockResolvedValue({});

      await service.adjustStock({
        productId: 'prod-1',
        variationId: 'var-1',
        delta: 3,
        adminUserId: 'admin-1',
      });

      expect(mockVariationUpdate).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { stock: { increment: 3 } },
      });
    });
  });

  // ─── AUDIT LOG ──────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('should return last 30 audit log entries', async () => {
      const mockLogs = Array.from({ length: 30 }, (_, i) => ({
        id: `log-${i}`,
        delta: 1,
      }));
      mockAuditFindMany.mockResolvedValue(mockLogs);

      const result = await service.getAuditLog('prod-1');

      expect(result).toHaveLength(30);
    });
  });
});
