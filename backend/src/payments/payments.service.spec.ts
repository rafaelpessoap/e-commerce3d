import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { MercadoPagoClient } from './mercadopago.client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let mpClient: MercadoPagoClient;

  const mockOrder = {
    id: 'order1',
    number: 'ORD-20260404-ABC1',
    subtotal: 100,
    shipping: 15,
    discount: 0,
    total: 115,
    status: 'PENDING',
    user: {
      id: 'user1',
      email: 'buyer@test.com',
      name: 'Test User',
      cpf: '12345678909',
    },
  };

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
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            order: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: MercadoPagoClient,
          useValue: {
            createPixPayment: jest.fn(),
            createCreditCardPayment: jest.fn(),
            createBoletoPayment: jest.fn(),
            getPayment: jest.fn(),
            verifyWebhookSignature: jest.fn(),
          },
        },
        {
          provide: StockService,
          useValue: {
            reserveStock: jest.fn().mockResolvedValue(undefined),
            confirmReservation: jest.fn().mockResolvedValue(undefined),
            releaseStock: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    mpClient = module.get<MercadoPagoClient>(MercadoPagoClient);
  });

  // ─── Existing: calculateMethodDiscount ───────────────────────

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

  // ─── createPayment: PIX ──────────────────────────────────────

  describe('createPayment — PIX', () => {
    it('should create PIX payment, call MP SDK, and return QR code data', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        method: 'pix',
        amount: 90,
        discount: 10,
        status: 'PENDING',
      });
      (mpClient.createPixPayment as jest.Mock).mockResolvedValue({
        id: 12345,
        qrCode: 'pix-code',
        qrCodeBase64: 'base64-img',
        expiresAt: '2026-04-05T00:00:00Z',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'pay1',
        externalId: '12345',
        pixQrCode: 'base64-img',
        pixCopiaECola: 'pix-code',
      });

      const result = await service.createPayment('order1', 'pix', {
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerName: 'Test User',
      });

      expect(mpClient.createPixPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 90,
          payerEmail: 'buyer@test.com',
        }),
      );
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalId: '12345',
            pixQrCode: 'base64-img',
            pixCopiaECola: 'pix-code',
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('should apply discount on SUBTOTAL (not total with shipping)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.payment.create as jest.Mock).mockImplementation(
        async (args: any) => ({
          id: 'pay1',
          ...args.data,
        }),
      );
      (mpClient.createPixPayment as jest.Mock).mockResolvedValue({
        id: 12345,
        qrCode: 'code',
        qrCodeBase64: 'img',
        expiresAt: '2026-04-05T00:00:00Z',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});

      await service.createPayment('order1', 'pix', {
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerName: 'Test',
      });

      // Discount: 10% of subtotal (100) = 10
      // Amount: subtotal - discount + shipping = 100 - 10 + 15 = 105
      // NOT: total - discount = 115 - 11.5 = 103.5
      const createCall = (prisma.payment.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.discount).toBe(10);
      expect(createCall.data.amount).toBe(105);
    });
  });

  // ─── createPayment: Credit Card ──────────────────────────────

  describe('createPayment — Credit Card', () => {
    it('should create CC payment with card token and return status', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay2',
        orderId: 'order1',
        method: 'credit_card',
        amount: 115,
        discount: 0,
        status: 'PENDING',
      });
      (mpClient.createCreditCardPayment as jest.Mock).mockResolvedValue({
        id: 67890,
        status: 'approved',
        statusDetail: 'accredited',
        cardLastFour: '6351',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'pay2',
        status: 'APPROVED',
        externalId: '67890',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({});

      const result = await service.createPayment('order1', 'credit_card', {
        cardToken: 'token-from-frontend',
        installments: 3,
        paymentMethodId: 'master',
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerName: 'APRO',
      });

      expect(mpClient.createCreditCardPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'token-from-frontend',
          installments: 3,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when cardToken is missing for credit_card', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      await expect(
        service.createPayment('order1', 'credit_card', {
          payerEmail: 'buyer@test.com',
          payerCpf: '12345678909',
          payerName: 'Test',
          // no cardToken!
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update payment to APPROVED when MP returns approved', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay2',
        orderId: 'order1',
        method: 'credit_card',
        amount: 115,
        discount: 0,
        status: 'PENDING',
      });
      (mpClient.createCreditCardPayment as jest.Mock).mockResolvedValue({
        id: 67890,
        status: 'approved',
        statusDetail: 'accredited',
        cardLastFour: '6351',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.order.update as jest.Mock).mockResolvedValue({});

      await service.createPayment('order1', 'credit_card', {
        cardToken: 'token',
        installments: 1,
        paymentMethodId: 'visa',
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerName: 'APRO',
      });

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            paidAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentStatus: 'APPROVED' }),
        }),
      );
    });

    it('should update payment to FAILED when MP returns rejected', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay2',
        orderId: 'order1',
        method: 'credit_card',
        amount: 115,
        discount: 0,
        status: 'PENDING',
      });
      (mpClient.createCreditCardPayment as jest.Mock).mockResolvedValue({
        id: 67890,
        status: 'rejected',
        statusDetail: 'cc_rejected_other_reason',
        cardLastFour: '5682',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});

      await service.createPayment('order1', 'credit_card', {
        cardToken: 'token',
        installments: 1,
        paymentMethodId: 'visa',
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerName: 'OTHE',
      });

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  // ─── createPayment: Boleto ───────────────────────────────────

  describe('createPayment — Boleto', () => {
    it('should create boleto payment and return URL + barcode', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.payment.create as jest.Mock).mockImplementation(
        async (args: any) => ({
          id: 'pay3',
          ...args.data,
        }),
      );
      (mpClient.createBoletoPayment as jest.Mock).mockResolvedValue({
        id: 11111,
        boletoUrl: 'https://mp.com/boleto/11111',
        barcode: '23793...',
        expiresAt: '2026-04-07T00:00:00Z',
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});

      const result = await service.createPayment('order1', 'boleto', {
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerName: 'Test User',
      });

      expect(mpClient.createBoletoPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 110, // subtotal(100) - 5%(5) + shipping(15) = 110
        }),
      );
      expect(result).toBeDefined();
    });
  });

  // ─── createPayment: Edge Cases ───────────────────────────────

  describe('createPayment — edge cases', () => {
    it('should throw NotFoundException for non-existent order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createPayment('fake', 'pix', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for unsupported payment method', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      await expect(
        service.createPayment('order1', 'bitcoin', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── processWebhook (with double-check) ──────────────────────

  describe('processWebhook', () => {
    it('should fetch payment from MP API and update status (double-check)', async () => {
      (mpClient.getPayment as jest.Mock).mockResolvedValue({
        id: 12345,
        status: 'approved',
        transaction_amount: 105,
        external_reference: 'order1',
      });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        status: 'PENDING',
        amount: 105,
      });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        total: 105,
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.order.update as jest.Mock).mockResolvedValue({});

      await service.processWebhook('12345');

      expect(mpClient.getPayment).toHaveBeenCalledWith('12345');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            paidAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentStatus: 'APPROVED' }),
        }),
      );
    });

    it('should be idempotent — skip if already in target status', async () => {
      (mpClient.getPayment as jest.Mock).mockResolvedValue({
        id: 12345,
        status: 'approved',
        transaction_amount: 105,
        external_reference: 'order1',
      });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        status: 'APPROVED',
        amount: 105,
      });

      await service.processWebhook('12345');

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('should ignore unknown MP payment IDs', async () => {
      (mpClient.getPayment as jest.Mock).mockResolvedValue({
        id: 99999,
        status: 'approved',
        transaction_amount: 100,
        external_reference: 'unknown-order',
      });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await service.processWebhook('99999');

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('should reject webhook when payment amount diverges from order', async () => {
      (mpClient.getPayment as jest.Mock).mockResolvedValue({
        id: 12345,
        status: 'approved',
        transaction_amount: 50,
        external_reference: 'order1',
      });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        status: 'PENDING',
        amount: 105,
      });

      await service.processWebhook('12345');

      // Should NOT update when amounts diverge
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('should update to FAILED when MP reports rejected', async () => {
      (mpClient.getPayment as jest.Mock).mockResolvedValue({
        id: 12345,
        status: 'rejected',
        transaction_amount: 105,
        external_reference: 'order1',
      });
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        status: 'PENDING',
        amount: 105,
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({});
      (prisma.order.update as jest.Mock).mockResolvedValue({});

      await service.processWebhook('12345');

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  // ─── getPaymentStatus ────────────────────────────────────────

  describe('getPaymentStatus', () => {
    it('should return payment status for polling', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay1',
        orderId: 'order1',
        status: 'APPROVED',
        method: 'pix',
      });

      const result = await service.getPaymentStatus('order1');

      expect(result).toEqual(
        expect.objectContaining({ status: 'APPROVED', method: 'pix' }),
      );
    });
  });
});
