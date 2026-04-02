import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: any;

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                SMTP_HOST: 'smtp.test.com',
                SMTP_PORT: '587',
                SMTP_USER: 'test@test.com',
                SMTP_PASSWORD: 'pass',
                SMTP_FROM: 'noreply@miniatures3d.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    // Inject mock transporter
    (service as any).transporter = mockTransporter;
  });

  describe('sendMail', () => {
    it('should send email with correct parameters', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Welcome',
        html: '<h1>Welcome!</h1>',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome',
          html: '<h1>Welcome!</h1>',
        }),
      );
    });

    it('should use configured from address', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@miniatures3d.com',
        }),
      );
    });
  });

  describe('sendOrderConfirmation', () => {
    it('should send order confirmation email', async () => {
      await service.sendOrderConfirmation({
        to: 'user@example.com',
        orderNumber: 'ORD-20260402-ABC123',
        total: 99.9,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('ORD-20260402-ABC123'),
        }),
      );
    });
  });

  describe('sendStatusChange', () => {
    it('should send status change email', async () => {
      await service.sendStatusChange({
        to: 'user@example.com',
        orderNumber: 'ORD-20260402-ABC123',
        newStatus: 'SHIPPED',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('SHIPPED'),
        }),
      );
    });
  });
});
