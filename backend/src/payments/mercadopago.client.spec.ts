import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoClient } from './mercadopago.client';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

// Mock the mercadopago SDK
const mockPaymentCreate = jest.fn();
const mockPaymentGet = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Payment: jest.fn().mockImplementation(() => ({
    create: mockPaymentCreate,
    get: mockPaymentGet,
  })),
}));

describe('MercadoPagoClient', () => {
  let client: MercadoPagoClient;
  const WEBHOOK_SECRET =
    'test-webhook-secret-64chars-minimum-for-security-purposes-here';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MercadoPagoClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                MERCADOPAGO_ACCESS_TOKEN: 'TEST-token-123',
                MERCADOPAGO_WEBHOOK_SECRET: WEBHOOK_SECRET,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    client = module.get<MercadoPagoClient>(MercadoPagoClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── PIX ─────────────────────────────────────────────────────

  describe('createPixPayment', () => {
    it('should call MP SDK with correct PIX params and return QR code data', async () => {
      mockPaymentCreate.mockResolvedValue({
        id: 12345,
        status: 'pending',
        point_of_interaction: {
          transaction_data: {
            qr_code: 'pix-copia-e-cola-string',
            qr_code_base64: 'base64-qr-image',
            ticket_url: 'https://mercadopago.com/pix/123',
          },
        },
        date_of_expiration: '2026-04-05T00:00:00.000Z',
      });

      const result = await client.createPixPayment({
        amount: 90,
        description: 'Pedido ORD-20260404-ABC1',
        externalReference: 'order-123',
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerFirstName: 'Test',
        payerLastName: 'Buyer',
      });

      expect(mockPaymentCreate).toHaveBeenCalledWith({
        body: expect.objectContaining({
          transaction_amount: 90,
          payment_method_id: 'pix',
          payer: expect.objectContaining({
            email: 'buyer@test.com',
            first_name: 'Test',
            last_name: 'Buyer',
          }),
        }),
      });

      expect(result.id).toBe(12345);
      expect(result.qrCode).toBe('pix-copia-e-cola-string');
      expect(result.qrCodeBase64).toBe('base64-qr-image');
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw BadRequestException when MP SDK fails', async () => {
      mockPaymentCreate.mockRejectedValue(new Error('MP API Error'));

      await expect(
        client.createPixPayment({
          amount: 90,
          description: 'Test',
          externalReference: 'order-123',
          payerEmail: 'buyer@test.com',
          payerCpf: '12345678909',
          payerFirstName: 'Test',
          payerLastName: 'Buyer',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── CREDIT CARD ─────────────────────────────────────────────

  describe('createCreditCardPayment', () => {
    it('should call MP SDK with card token and return status', async () => {
      mockPaymentCreate.mockResolvedValue({
        id: 67890,
        status: 'approved',
        status_detail: 'accredited',
        card: { last_four_digits: '6351' },
      });

      const result = await client.createCreditCardPayment({
        amount: 150,
        token: 'card-token-from-frontend',
        installments: 3,
        paymentMethodId: 'master',
        description: 'Pedido ORD-20260404-DEF2',
        externalReference: 'order-456',
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerFirstName: 'Test',
        payerLastName: 'Buyer',
      });

      expect(mockPaymentCreate).toHaveBeenCalledWith({
        body: expect.objectContaining({
          transaction_amount: 150,
          token: 'card-token-from-frontend',
          installments: 3,
          payment_method_id: 'master',
          payer: expect.objectContaining({
            email: 'buyer@test.com',
            first_name: 'Test',
            last_name: 'Buyer',
          }),
        }),
      });

      expect(result.id).toBe(67890);
      expect(result.status).toBe('approved');
      expect(result.statusDetail).toBe('accredited');
      expect(result.cardLastFour).toBe('6351');
    });

    it('should handle rejected credit card payment', async () => {
      mockPaymentCreate.mockResolvedValue({
        id: 67891,
        status: 'rejected',
        status_detail: 'cc_rejected_other_reason',
        card: { last_four_digits: '5682' },
      });

      const result = await client.createCreditCardPayment({
        amount: 150,
        token: 'card-token',
        installments: 1,
        paymentMethodId: 'visa',
        description: 'Test',
        externalReference: 'order-456',
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerFirstName: 'Test',
        payerLastName: 'Buyer',
      });

      expect(result.status).toBe('rejected');
      expect(result.statusDetail).toBe('cc_rejected_other_reason');
    });

    it('should throw BadRequestException when MP SDK fails for card', async () => {
      mockPaymentCreate.mockRejectedValue(new Error('Card processing error'));

      await expect(
        client.createCreditCardPayment({
          amount: 150,
          token: 'bad-token',
          installments: 1,
          paymentMethodId: 'visa',
          description: 'Test',
          externalReference: 'order-456',
          payerEmail: 'buyer@test.com',
          payerCpf: '12345678909',
          payerFirstName: 'Test',
          payerLastName: 'Buyer',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── BOLETO ──────────────────────────────────────────────────

  describe('createBoletoPayment', () => {
    it('should call MP SDK with bolbradesco and return URL + barcode', async () => {
      mockPaymentCreate.mockResolvedValue({
        id: 11111,
        status: 'pending',
        transaction_details: {
          external_resource_url: 'https://mercadopago.com/boleto/11111',
        },
        barcode: {
          content: '23793.38128 60000.000003 00000.000402 1 84340000010000',
        },
        date_of_expiration: '2026-04-07T00:00:00.000Z',
      });

      const result = await client.createBoletoPayment({
        amount: 95,
        description: 'Pedido ORD-20260404-GHI3',
        externalReference: 'order-789',
        payerEmail: 'buyer@test.com',
        payerCpf: '12345678909',
        payerFirstName: 'Test',
        payerLastName: 'User',
      });

      expect(mockPaymentCreate).toHaveBeenCalledWith({
        body: expect.objectContaining({
          transaction_amount: 95,
          payment_method_id: 'bolbradesco',
        }),
      });

      expect(result.id).toBe(11111);
      expect(result.boletoUrl).toBe('https://mercadopago.com/boleto/11111');
      expect(result.barcode).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw BadRequestException when boleto creation fails', async () => {
      mockPaymentCreate.mockRejectedValue(new Error('Boleto error'));

      await expect(
        client.createBoletoPayment({
          amount: 95,
          description: 'Test',
          externalReference: 'order-789',
          payerEmail: 'buyer@test.com',
          payerCpf: '12345678909',
          payerFirstName: 'Test',
          payerLastName: 'User',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── GET PAYMENT (double-check) ──────────────────────────────

  describe('getPayment', () => {
    it('should fetch payment from MP API by ID', async () => {
      mockPaymentGet.mockResolvedValue({
        id: 12345,
        status: 'approved',
        transaction_amount: 90,
        external_reference: 'order-123',
      });

      const result = await client.getPayment('12345');

      expect(mockPaymentGet).toHaveBeenCalledWith({ id: '12345' });
      expect(result.status).toBe('approved');
      expect(result.transaction_amount).toBe(90);
    });

    it('should throw BadRequestException when payment not found', async () => {
      mockPaymentGet.mockRejectedValue(new Error('Payment not found'));

      await expect(client.getPayment('99999')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── WEBHOOK SIGNATURE VERIFICATION ──────────────────────────

  describe('verifyWebhookSignature', () => {
    function generateValidSignature(
      dataId: string,
      requestId: string,
      ts: string,
      secret: string,
    ): string {
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(manifest)
        .digest('hex');
      return `ts=${ts},v1=${hmac}`;
    }

    it('should return true for valid webhook signature', () => {
      const dataId = '12345';
      const requestId = 'req-abc-123';
      const ts = '1712345678';
      const signature = generateValidSignature(
        dataId,
        requestId,
        ts,
        WEBHOOK_SECRET,
      );

      const result = client.verifyWebhookSignature({
        xSignature: signature,
        xRequestId: requestId,
        dataId,
      });

      expect(result).toBe(true);
    });

    it('should return false for tampered webhook signature', () => {
      const result = client.verifyWebhookSignature({
        xSignature: 'ts=1712345678,v1=tampered-signature-hash',
        xRequestId: 'req-abc-123',
        dataId: '12345',
      });

      expect(result).toBe(false);
    });

    it('should return false when x-signature header is missing or malformed', () => {
      const result = client.verifyWebhookSignature({
        xSignature: '',
        xRequestId: 'req-abc-123',
        dataId: '12345',
      });

      expect(result).toBe(false);
    });

    it('should return false when ts or v1 part is missing', () => {
      const result = client.verifyWebhookSignature({
        xSignature: 'ts=1712345678',
        xRequestId: 'req-abc-123',
        dataId: '12345',
      });

      expect(result).toBe(false);
    });
  });
});
