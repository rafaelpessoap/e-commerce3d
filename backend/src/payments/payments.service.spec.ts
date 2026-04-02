import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            payment: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            order: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('calculateMethodDiscount', () => {
    it('should return 10% discount for PIX', () => {
      expect(service.calculateMethodDiscount('pix', 100)).toBe(10);
    });

    it('should return 5% discount for boleto', () => {
      expect(service.calculateMethodDiscount('boleto', 100)).toBe(5);
    });

    it('should return 0 for credit_card', () => {
      expect(service.calculateMethodDiscount('credit_card', 100)).toBe(0);
    });
  });

  describe('createPayment', () => {
    it('should create payment record for existing order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        total: 100,
        status: 'PENDING',
      });
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        method: 'pix',
        amount: 90,
        discount: 10,
        status: 'PENDING',
      });

      const result = await service.createPayment('order1', 'pix');

      expect(result.amount).toBe(90);
      expect(result.discount).toBe(10);
    });

    it('should throw NotFoundException for non-existent order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createPayment('fake', 'pix')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('processWebhook', () => {
    it('should update payment and order status on approval', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        status: 'PENDING',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'pay1',
        status: 'APPROVED',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({});

      await service.processWebhook({
        externalId: 'mp_123',
        status: 'approved',
      });

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentStatus: 'APPROVED' }),
        }),
      );
    });

    it('should be idempotent — skip already approved payments', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        status: 'APPROVED',
      });

      await service.processWebhook({
        externalId: 'mp_123',
        status: 'approved',
      });

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('should ignore unknown external IDs', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      await service.processWebhook({
        externalId: 'unknown',
        status: 'approved',
      });

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });
});
