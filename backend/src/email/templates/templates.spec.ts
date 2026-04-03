import { render } from '@react-email/render';
import { WelcomeEmail } from './welcome';
import { OrderConfirmationEmail } from './order-confirmation';
import { StatusChangeEmail } from './status-change';
import { PasswordResetEmail } from './password-reset';
import { ReviewRewardEmail } from './review-reward';

describe('Email Templates', () => {
  describe('WelcomeEmail', () => {
    it('should render with user name', async () => {
      const html = await render(WelcomeEmail({ name: 'João Silva' }));
      expect(html).toContain('João Silva');
    });

    it('should contain welcome message', async () => {
      const html = await render(WelcomeEmail({ name: 'Maria' }));
      expect(html).toContain('Bem-vindo');
    });

    it('should contain link to store', async () => {
      const html = await render(WelcomeEmail({ name: 'Carlos' }));
      expect(html).toContain('href=');
    });
  });

  describe('OrderConfirmationEmail', () => {
    const props = {
      orderNumber: 'ORD-20260402-ABC123',
      customerName: 'João Silva',
      items: [
        { name: 'Miniatura Elfa Guerreira', quantity: 2, price: 49.9 },
        { name: 'Kit Dungeon Master', quantity: 1, price: 129.9 },
      ],
      subtotal: 229.7,
      shipping: 15.0,
      discount: 10.0,
      total: 234.7,
      paymentMethod: 'PIX',
    };

    it('should render order number', async () => {
      const html = await render(OrderConfirmationEmail(props));
      expect(html).toContain('ORD-20260402-ABC123');
    });

    it('should render all items', async () => {
      const html = await render(OrderConfirmationEmail(props));
      expect(html).toContain('Miniatura Elfa Guerreira');
      expect(html).toContain('Kit Dungeon Master');
    });

    it('should render totals', async () => {
      const html = await render(OrderConfirmationEmail(props));
      expect(html).toContain('234,70');
    });

    it('should render payment method', async () => {
      const html = await render(OrderConfirmationEmail(props));
      expect(html).toContain('PIX');
    });

    it('should render customer name', async () => {
      const html = await render(OrderConfirmationEmail(props));
      expect(html).toContain('João Silva');
    });
  });

  describe('StatusChangeEmail', () => {
    const props = {
      customerName: 'Ana',
      orderNumber: 'ORD-20260402-DEF456',
      newStatus: 'SHIPPED' as const,
      trackingCode: 'BR123456789',
    };

    it('should render order number', async () => {
      const html = await render(StatusChangeEmail(props));
      expect(html).toContain('ORD-20260402-DEF456');
    });

    it('should render status label in Portuguese', async () => {
      const html = await render(StatusChangeEmail(props));
      expect(html).toContain('Enviado');
    });

    it('should render tracking code when SHIPPED', async () => {
      const html = await render(StatusChangeEmail(props));
      expect(html).toContain('BR123456789');
    });

    it('should NOT render tracking code for non-shipped status', async () => {
      const html = await render(
        StatusChangeEmail({
          customerName: 'Ana',
          orderNumber: 'ORD-123',
          newStatus: 'PROCESSING',
        }),
      );
      expect(html).not.toContain('Código de rastreio');
    });

    it('should render customer name', async () => {
      const html = await render(StatusChangeEmail(props));
      expect(html).toContain('Ana');
    });
  });

  describe('PasswordResetEmail', () => {
    const props = {
      name: 'Carlos',
      resetUrl: 'https://elitepinup3d.com/reset-password?token=abc123',
    };

    it('should render reset link', async () => {
      const html = await render(PasswordResetEmail(props));
      expect(html).toContain(
        'https://elitepinup3d.com/reset-password?token=abc123',
      );
    });

    it('should contain expiry warning', async () => {
      const html = await render(PasswordResetEmail(props));
      expect(html).toContain('1 hora');
    });

    it('should render user name', async () => {
      const html = await render(PasswordResetEmail(props));
      expect(html).toContain('Carlos');
    });
  });

  describe('ReviewRewardEmail', () => {
    const props = {
      customerName: 'Maria',
      productName: 'Miniatura Dragão Ancião',
      couponCode: 'REVIEW-ABC123',
      discountPercent: 5,
    };

    it('should render coupon code', async () => {
      const html = await render(ReviewRewardEmail(props));
      expect(html).toContain('REVIEW-ABC123');
    });

    it('should render discount percentage', async () => {
      const html = await render(ReviewRewardEmail(props));
      // React may insert comment nodes between text nodes
      expect(html).toMatch(/5[^0-9]*%/);
    });

    it('should render product name', async () => {
      const html = await render(ReviewRewardEmail(props));
      expect(html).toContain('Miniatura Dragão Ancião');
    });

    it('should render customer name', async () => {
      const html = await render(ReviewRewardEmail(props));
      expect(html).toContain('Maria');
    });
  });
});
