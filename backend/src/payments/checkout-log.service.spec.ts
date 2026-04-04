import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutLogService } from './checkout-log.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CheckoutLogService', () => {
  let service: CheckoutLogService;
  const mockCreate = jest.fn().mockResolvedValue({ id: 'log-1' });
  const mockFindMany = jest.fn().mockResolvedValue([]);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutLogService,
        {
          provide: PrismaService,
          useValue: {
            checkoutLog: {
              create: mockCreate,
              findMany: mockFindMany,
            },
          },
        },
      ],
    }).compile();

    service = module.get<CheckoutLogService>(CheckoutLogService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create a checkout log entry', async () => {
      await service.log({
        step: 'create_order',
        status: 'success',
        orderId: 'order-123',
        userId: 'user-456',
        method: 'pix',
        request: { items: [{ productId: 'p1' }] },
        response: { id: 'order-123' },
        duration: 250,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          step: 'create_order',
          status: 'success',
          orderId: 'order-123',
          userId: 'user-456',
          method: 'pix',
          duration: 250,
        }),
      });
    });

    it('should sanitize sensitive data from request (cardToken, password)', async () => {
      await service.log({
        step: 'create_payment',
        status: 'success',
        request: {
          orderId: 'order-123',
          method: 'credit_card',
          cardToken: 'secret-token-abc',
          payerCpf: '12345678909',
          payerEmail: 'test@test.com',
        },
      });

      const callData = mockCreate.mock.calls[0][0].data;
      const requestJson = JSON.parse(callData.request);
      expect(requestJson.cardToken).toBe('[REDACTED]');
      expect(requestJson.payerCpf).toBe('[REDACTED]');
      expect(requestJson.payerEmail).toBe('test@test.com');
    });

    it('should log errors with message', async () => {
      await service.log({
        step: 'create_payment',
        status: 'error',
        orderId: 'order-123',
        method: 'pix',
        error: new Error('MP API Error: internal_error'),
        request: { orderId: 'order-123' },
      });

      const callData = mockCreate.mock.calls[0][0].data;
      expect(callData.status).toBe('error');
      expect(callData.error).toContain('MP API Error: internal_error');
    });

    it('should not throw when logging fails (fire-and-forget)', async () => {
      mockCreate.mockRejectedValueOnce(new Error('DB error'));

      // Should NOT throw
      await service.log({
        step: 'create_order',
        status: 'success',
      });
    });
  });

  describe('findByOrder', () => {
    it('should return logs for a specific order', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'log-1', step: 'create_order', status: 'success' },
        { id: 'log-2', step: 'create_payment', status: 'error' },
      ]);

      const result = await service.findByOrder('order-123');

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { orderId: 'order-123' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(2);
    });
  });
});
