import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(private configService: ConfigService) {
    this.from =
      this.configService.get<string>('SMTP_FROM') ?? 'noreply@miniatures3d.com';

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

  async sendOrderConfirmation(params: {
    to: string;
    orderNumber: string;
    total: number;
  }) {
    return this.sendMail({
      to: params.to,
      subject: `Pedido confirmado: ${params.orderNumber}`,
      html: `
        <h1>Pedido Confirmado!</h1>
        <p>Seu pedido <strong>${params.orderNumber}</strong> foi recebido.</p>
        <p>Total: R$ ${params.total.toFixed(2)}</p>
        <p>Acompanhe o status do seu pedido em nossa loja.</p>
      `,
    });
  }

  async sendStatusChange(params: {
    to: string;
    orderNumber: string;
    newStatus: string;
  }) {
    const statusLabels: Record<string, string> = {
      CONFIRMED: 'Confirmado',
      PROCESSING: 'Em produção',
      SHIPPED: 'Enviado',
      DELIVERED: 'Entregue',
      CANCELLED: 'Cancelado',
    };

    const label = statusLabels[params.newStatus] ?? params.newStatus;

    return this.sendMail({
      to: params.to,
      subject: `Pedido ${params.orderNumber} — Status: ${params.newStatus}`,
      html: `
        <h1>Atualização do Pedido</h1>
        <p>Seu pedido <strong>${params.orderNumber}</strong> está agora: <strong>${label}</strong></p>
      `,
    });
  }

  async sendWelcome(params: { to: string; name: string }) {
    return this.sendMail({
      to: params.to,
      subject: 'Bem-vindo à Miniatures 3D!',
      html: `
        <h1>Olá, ${params.name}!</h1>
        <p>Sua conta foi criada com sucesso.</p>
        <p>Explore nosso catálogo de miniaturas 3D!</p>
      `,
    });
  }

  async sendPasswordReset(params: { to: string; resetUrl: string }) {
    return this.sendMail({
      to: params.to,
      subject: 'Redefinição de senha',
      html: `
        <h1>Redefinir Senha</h1>
        <p>Clique no link abaixo para redefinir sua senha:</p>
        <a href="${params.resetUrl}">${params.resetUrl}</a>
        <p>Este link expira em 1 hora.</p>
      `,
    });
  }
}
