import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: any;
  let emailTemplateService: EmailTemplateService;

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
                SMTP_FROM: 'noreply@elitepinup3d.com',
                FRONTEND_URL: 'https://elitepinup3d.com',
              };
              return config[key];
            }),
          },
        },
        {
          provide: EmailTemplateService,
          useValue: {
            findByType: jest.fn(),
            renderTemplate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    emailTemplateService = module.get<EmailTemplateService>(EmailTemplateService);
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
          from: 'noreply@elitepinup3d.com',
        }),
      );
    });
  });

  describe('sendWelcome — DB template', () => {
    it('should use DB template when available', async () => {
      const dbTemplate = {
        id: 'tpl1',
        type: 'welcome',
        subject: 'Olá {{nome_cliente}}!',
        htmlBody: '<h1>Olá {{nome_cliente}}</h1>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(dbTemplate);
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'Olá João!',
        html: '<h1>Olá João</h1>',
      });

      await service.sendWelcome({ to: 'user@example.com', name: 'João' });

      expect(emailTemplateService.findByType).toHaveBeenCalledWith('welcome');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Olá João!',
          html: '<h1>Olá João</h1>',
        }),
      );
    });

    it('should fallback to React Email when DB template not found', async () => {
      (emailTemplateService.findByType as jest.Mock).mockRejectedValue(
        new NotFoundException(),
      );

      await service.sendWelcome({ to: 'user@example.com', name: 'João' });

      // Should still send email (via React Email fallback)
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          html: expect.stringContaining('João'),
        }),
      );
    });
  });

  describe('sendOrderConfirmation — DB template', () => {
    it('should use DB template with items formatted', async () => {
      const dbTemplate = {
        type: 'order-confirmation',
        subject: 'Pedido {{numero_pedido}}',
        htmlBody: '<p>{{itens_pedido}}</p><p>Total: R$ {{total}}</p>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(dbTemplate);
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'Pedido ORD-123',
        html: '<p>Items</p><p>Total: R$ 60,00</p>',
      });

      await service.sendOrderConfirmation({
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

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Pedido ORD-123',
        }),
      );
    });
  });

  describe('sendStatusChange — DB template', () => {
    it('should use DB template with status label', async () => {
      const dbTemplate = {
        type: 'status-change',
        subject: '{{numero_pedido}} — {{status_label}}',
        htmlBody: '<p>{{status_descricao}}</p>{{rastreio_secao}}',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(dbTemplate);
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'ORD-456 — Enviado',
        html: '<p>Seu pedido foi despachado!</p><div>BR123</div>',
      });

      await service.sendStatusChange({
        to: 'user@example.com',
        customerName: 'Ana',
        orderNumber: 'ORD-456',
        newStatus: 'SHIPPED',
        trackingCode: 'BR123',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'ORD-456 — Enviado',
        }),
      );
    });
  });

  describe('sendPasswordReset — DB template', () => {
    it('should use DB template with reset URL', async () => {
      const dbTemplate = {
        type: 'password-reset',
        subject: 'Redefinição de senha',
        htmlBody: '<a href="{{url_redefinicao}}">Redefinir</a>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(dbTemplate);
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: 'Redefinição de senha',
        html: '<a href="https://example.com/reset">Redefinir</a>',
      });

      await service.sendPasswordReset({
        to: 'user@example.com',
        name: 'Carlos',
        resetUrl: 'https://example.com/reset',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('reset'),
        }),
      );
    });
  });

  describe('sendReviewReward — DB template', () => {
    it('should use DB template with coupon code', async () => {
      const dbTemplate = {
        type: 'review-reward',
        subject: '{{percentual_desconto}}% de desconto!',
        htmlBody: '<p>Cupom: {{codigo_cupom}}</p>',
        isActive: true,
      };
      (emailTemplateService.findByType as jest.Mock).mockResolvedValue(dbTemplate);
      (emailTemplateService.renderTemplate as jest.Mock).mockReturnValue({
        subject: '5% de desconto!',
        html: '<p>Cupom: REVIEW-XYZ</p>',
      });

      await service.sendReviewReward({
        to: 'user@example.com',
        customerName: 'Maria',
        productName: 'Dragão',
        couponCode: 'REVIEW-XYZ',
        discountPercent: 5,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '5% de desconto!',
          html: expect.stringContaining('REVIEW-XYZ'),
        }),
      );
    });
  });
});
