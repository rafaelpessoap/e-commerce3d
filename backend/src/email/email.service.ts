import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import { EmailTemplateService } from './email-template.service';
import { WelcomeEmail } from './templates/welcome';
import { OrderConfirmationEmail } from './templates/order-confirmation';
import { StatusChangeEmail } from './templates/status-change';
import { PasswordResetEmail } from './templates/password-reset';
import { ReviewRewardEmail } from './templates/review-reward';

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Em Produção',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devolvido',
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  CONFIRMED: 'Seu pagamento foi confirmado e seu pedido está na fila de produção.',
  PROCESSING: 'Suas miniaturas estão sendo produzidas com carinho!',
  SHIPPED: 'Seu pedido foi despachado e está a caminho!',
  DELIVERED: 'Seu pedido foi entregue. Esperamos que goste!',
  CANCELLED: 'Seu pedido foi cancelado. Se tiver dúvidas, entre em contato.',
  RETURNED: 'Seu pedido foi devolvido. Entraremos em contato sobre o reembolso.',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private from: string;
  private storeUrl: string;

  constructor(
    private configService: ConfigService,
    private emailTemplateService: EmailTemplateService,
  ) {
    this.from =
      this.configService.get<string>('SMTP_FROM') ?? 'noreply@elitepinup3d.com';
    this.storeUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'https://elitepinup3d.com';

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: parseInt(this.configService.get<string>('SMTP_PORT') ?? '587', 10),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  async sendMail(params: { to: string; subject: string; html: string }) {
    return this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }

  /**
   * Tenta usar template do banco (editável pelo admin).
   * Se não encontrar, usa fallback React Email.
   */
  private async renderFromDb(
    type: string,
    variables: Record<string, string>,
    fallbackFn: () => Promise<string>,
    fallbackSubject: string,
  ): Promise<{ subject: string; html: string }> {
    try {
      const template = await this.emailTemplateService.findByType(type);
      if (template.isActive) {
        return this.emailTemplateService.renderTemplate(template, {
          ...variables,
          url_loja: this.storeUrl,
        });
      }
    } catch {
      this.logger.warn(
        `Template '${type}' not found in DB, using React Email fallback`,
      );
    }

    // Fallback: React Email
    const html = await fallbackFn();
    return { subject: fallbackSubject, html };
  }

  async sendWelcome(params: { to: string; name: string }) {
    const { subject, html } = await this.renderFromDb(
      'welcome',
      {
        nome_cliente: params.name,
        email_cliente: params.to,
      },
      () => render(WelcomeEmail({ name: params.name })),
      `Bem-vindo à ElitePinup3D, ${params.name}!`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendOrderConfirmation(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
    paymentMethod: string;
  }) {
    // Build items HTML for the DB template tag
    const itemsHtml = params.items
      .map(
        (item) =>
          `<div style="padding:8px 0;display:flex;justify-content:space-between"><span style="color:#1a1a2e;font-size:14px">${item.name} × ${item.quantity}</span><span style="color:#1a1a2e;font-size:14px">R$ ${formatCurrency(item.price * item.quantity)}</span></div>`,
      )
      .join('');

    const { subject, html } = await this.renderFromDb(
      'order-confirmation',
      {
        nome_cliente: params.customerName,
        numero_pedido: params.orderNumber,
        itens_pedido: itemsHtml,
        subtotal: formatCurrency(params.subtotal),
        frete: params.shipping > 0 ? `R$ ${formatCurrency(params.shipping)}` : 'Grátis',
        desconto:
          params.discount > 0
            ? `-R$ ${formatCurrency(params.discount)}`
            : 'R$ 0,00',
        total: formatCurrency(params.total),
        metodo_pagamento: params.paymentMethod,
      },
      () => render(OrderConfirmationEmail(params)),
      `Pedido confirmado: ${params.orderNumber}`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendStatusChange(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    newStatus: string;
    trackingCode?: string;
  }) {
    const label = STATUS_LABELS[params.newStatus] ?? params.newStatus;
    const description = STATUS_DESCRIPTIONS[params.newStatus] ?? '';

    let rastreioHtml = '';
    if (params.newStatus === 'SHIPPED' && params.trackingCode) {
      rastreioHtml = `
        <div style="background:#f6f9fc;border-radius:6px;padding:12px 16px;margin:16px 0">
          <p style="font-size:12px;color:#8898aa;text-transform:uppercase;margin:0 0 4px">Código de rastreio</p>
          <p style="font-size:20px;color:#1a1a2e;font-weight:bold;font-family:monospace;margin:0">${params.trackingCode}</p>
        </div>`;
    }

    const { subject, html } = await this.renderFromDb(
      'status-change',
      {
        nome_cliente: params.customerName,
        numero_pedido: params.orderNumber,
        status_label: label,
        status_descricao: description,
        rastreio_secao: rastreioHtml,
        codigo_rastreio: params.trackingCode ?? '',
      },
      () =>
        render(
          StatusChangeEmail({
            customerName: params.customerName,
            orderNumber: params.orderNumber,
            newStatus: params.newStatus,
            trackingCode: params.trackingCode,
          }),
        ),
      `Pedido ${params.orderNumber} — ${label}`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendPasswordReset(params: {
    to: string;
    name: string;
    resetUrl: string;
  }) {
    const { subject, html } = await this.renderFromDb(
      'password-reset',
      {
        nome_cliente: params.name,
        url_redefinicao: params.resetUrl,
      },
      () => render(PasswordResetEmail({ name: params.name, resetUrl: params.resetUrl })),
      'Redefinição de senha — ElitePinup3D',
    );

    return this.sendMail({ to: params.to, subject, html });
  }

  async sendReviewReward(params: {
    to: string;
    customerName: string;
    productName: string;
    couponCode: string;
    discountPercent: number;
  }) {
    const { subject, html } = await this.renderFromDb(
      'review-reward',
      {
        nome_cliente: params.customerName,
        nome_produto: params.productName,
        codigo_cupom: params.couponCode,
        percentual_desconto: String(params.discountPercent),
      },
      () => render(ReviewRewardEmail(params)),
      `Você ganhou ${params.discountPercent}% de desconto!`,
    );

    return this.sendMail({ to: params.to, subject, html });
  }
}
