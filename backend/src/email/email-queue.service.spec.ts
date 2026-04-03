import { Test, TestingModule } from '@nestjs/testing';
import { EmailQueueService } from './email-queue.service';
import { EmailService } from './email.service';
import { Queue } from 'bullmq';

// Mock BullMQ Queue
jest.mock('bullmq', () => {
  const mockAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: mockAdd,
      close: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn(),
    })),
  };
});

describe('EmailQueueService', () => {
  let service: EmailQueueService;
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailQueueService,
        {
          provide: EmailService,
          useValue: {
            sendWelcome: jest.fn().mockResolvedValue({ messageId: 'msg1' }),
            sendOrderConfirmation: jest.fn().mockResolvedValue({ messageId: 'msg2' }),
            sendStatusChange: jest.fn().mockResolvedValue({ messageId: 'msg3' }),
            sendPasswordReset: jest.fn().mockResolvedValue({ messageId: 'msg4' }),
            sendReviewReward: jest.fn().mockResolvedValue({ messageId: 'msg5' }),
          },
        },
        {
          provide: 'REDIS_CONNECTION',
          useValue: { host: 'localhost', port: 6379 },
        },
      ],
    }).compile();

    service = module.get<EmailQueueService>(EmailQueueService);
    emailService = module.get<EmailService>(EmailService);
  });

  describe('enqueueWelcome', () => {
    it('should add welcome job to queue', async () => {
      const result = await service.enqueueWelcome({
        to: 'user@example.com',
        name: 'João',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('job-1');
    });
  });

  describe('enqueueOrderConfirmation', () => {
    it('should add order confirmation job to queue', async () => {
      const result = await service.enqueueOrderConfirmation({
        to: 'user@example.com',
        customerName: 'Maria',
        orderNumber: 'ORD-123',
        items: [{ name: 'Miniatura', quantity: 1, price: 50 }],
        subtotal: 50,
        shipping: 10,
        discount: 0,
        total: 60,
        paymentMethod: 'PIX',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueStatusChange', () => {
    it('should add status change job to queue', async () => {
      const result = await service.enqueueStatusChange({
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        newStatus: 'SHIPPED',
        trackingCode: 'BR123',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueuePasswordReset', () => {
    it('should add password reset job to queue', async () => {
      const result = await service.enqueuePasswordReset({
        to: 'user@example.com',
        name: 'Carlos',
        resetUrl: 'https://elitepinup3d.com/reset?token=abc',
      });

      expect(result).toBeDefined();
    });
  });

  describe('enqueueReviewReward', () => {
    it('should add review reward job to queue', async () => {
      const result = await service.enqueueReviewReward({
        to: 'user@example.com',
        customerName: 'Maria',
        productName: 'Dragão',
        couponCode: 'REVIEW-XYZ',
        discountPercent: 5,
      });

      expect(result).toBeDefined();
    });
  });

  describe('processJob', () => {
    it('should call sendWelcome for welcome type', async () => {
      await service.processJob({
        type: 'welcome',
        payload: { to: 'user@example.com', name: 'João' },
      });

      expect(emailService.sendWelcome).toHaveBeenCalledWith({
        to: 'user@example.com',
        name: 'João',
      });
    });

    it('should call sendOrderConfirmation for order-confirmation type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Maria',
        orderNumber: 'ORD-123',
        items: [],
        subtotal: 50,
        shipping: 10,
        discount: 0,
        total: 60,
        paymentMethod: 'PIX',
      };

      await service.processJob({ type: 'order-confirmation', payload });

      expect(emailService.sendOrderConfirmation).toHaveBeenCalledWith(payload);
    });

    it('should call sendStatusChange for status-change type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        newStatus: 'SHIPPED',
      };

      await service.processJob({ type: 'status-change', payload });

      expect(emailService.sendStatusChange).toHaveBeenCalledWith(payload);
    });

    it('should call sendPasswordReset for password-reset type', async () => {
      const payload = {
        to: 'user@example.com',
        name: 'Carlos',
        resetUrl: 'https://example.com/reset',
      };

      await service.processJob({ type: 'password-reset', payload });

      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(payload);
    });

    it('should call sendReviewReward for review-reward type', async () => {
      const payload = {
        to: 'user@example.com',
        customerName: 'Maria',
        productName: 'Dragão',
        couponCode: 'ABC',
        discountPercent: 5,
      };

      await service.processJob({ type: 'review-reward', payload });

      expect(emailService.sendReviewReward).toHaveBeenCalledWith(payload);
    });

    it('should throw for unknown email type', async () => {
      await expect(
        service.processJob({ type: 'unknown' as any, payload: {} }),
      ).rejects.toThrow('Unknown email type: unknown');
    });
  });
});
