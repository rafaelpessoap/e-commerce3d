import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoClient } from './mercadopago.client';
import { StockService } from '../stock/stock.service';

// Descontos configuráveis por método de pagamento (aplicados sobre SUBTOTAL)
const METHOD_DISCOUNTS: Record<string, number> = {
  pix: 10, // 10%
  boleto: 5, // 5%
  credit_card: 0,
  debit_card: 0,
};

const WEBHOOK_STATUS_MAP: Record<string, string> = {
  approved: 'APPROVED',
  authorized: 'APPROVED',
  pending: 'PENDING',
  in_process: 'PENDING',
  rejected: 'FAILED',
  cancelled: 'CANCELLED',
  refunded: 'CANCELLED',
  charged_back: 'CANCELLED',
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private mpClient: MercadoPagoClient,
    private stockService: StockService,
  ) {}

  calculateMethodDiscount(method: string, amount: number): number {
    const percentage = METHOD_DISCOUNTS[method] ?? 0;
    return Math.round(amount * (percentage / 100) * 100) / 100;
  }

  async createPayment(
    orderId: string,
    method: string,
    extra?: {
      cardToken?: string;
      installments?: number;
      paymentMethodId?: string;
      payerEmail?: string;
      payerCpf?: string;
      payerName?: string;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Desconto sobre SUBTOTAL (não total que inclui frete)
    const discount = this.calculateMethodDiscount(method, order.subtotal);
    const amount =
      Math.round((order.subtotal - discount + order.shipping) * 100) / 100;

    // Criar registro local PENDING
    const payment = await this.prisma.payment.create({
      data: { orderId, method, amount, discount, status: 'PENDING' },
    });

    const payerEmail = extra?.payerEmail ?? order.user?.email ?? '';
    const payerCpf = extra?.payerCpf ?? (order.user as any)?.cpf ?? '';
    const payerName = extra?.payerName ?? order.user?.name ?? '';
    const nameParts = payerName.split(' ');
    const payerFirstName = nameParts[0] || payerName || 'Cliente';
    const payerLastName = nameParts.slice(1).join(' ') || payerFirstName;

    // Dispatcher por método
    switch (method) {
      case 'pix':
        return this.handlePixPayment(
          payment,
          order,
          payerEmail,
          payerCpf,
          payerFirstName,
          payerLastName,
        );
      case 'boleto':
        return this.handleBoletoPayment(
          payment,
          order,
          payerEmail,
          payerCpf,
          payerFirstName,
          payerLastName,
        );
      case 'credit_card':
        return this.handleCreditCardPayment(
          payment,
          order,
          payerEmail,
          payerCpf,
          payerFirstName,
          payerLastName,
          extra,
        );
      default:
        throw new BadRequestException(
          `Método de pagamento não suportado: ${method}`,
        );
    }
  }

  private async handlePixPayment(
    payment: any,
    order: any,
    payerEmail: string,
    payerCpf: string,
    payerFirstName: string,
    payerLastName: string,
  ) {
    const mpResult = await this.mpClient.createPixPayment({
      amount: payment.amount,
      description: `Pedido ${order.number ?? order.id}`,
      externalReference: order.id,
      payerEmail,
      payerCpf,
      payerFirstName,
      payerLastName,
    });

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: String(mpResult.id),
        pixQrCode: mpResult.qrCodeBase64,
        pixCopiaECola: mpResult.qrCode,
        expiresAt: mpResult.expiresAt ? new Date(mpResult.expiresAt) : null,
      },
    });
  }

  private async handleBoletoPayment(
    payment: any,
    order: any,
    payerEmail: string,
    payerCpf: string,
    payerFirstName: string,
    payerLastName: string,
  ) {
    const mpResult = await this.mpClient.createBoletoPayment({
      amount: payment.amount,
      description: `Pedido ${order.number ?? order.id}`,
      externalReference: order.id,
      payerEmail,
      payerCpf,
      payerFirstName,
      payerLastName,
    });

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: String(mpResult.id),
        boletoUrl: mpResult.boletoUrl,
        boletoBarcode: mpResult.barcode,
        expiresAt: mpResult.expiresAt ? new Date(mpResult.expiresAt) : null,
      },
    });
  }

  private async handleCreditCardPayment(
    payment: any,
    order: any,
    payerEmail: string,
    payerCpf: string,
    payerFirstName: string,
    payerLastName: string,
    extra?: {
      cardToken?: string;
      installments?: number;
      paymentMethodId?: string;
      payerEmail?: string;
      payerCpf?: string;
      payerName?: string;
    },
  ) {
    if (!extra?.cardToken) {
      throw new BadRequestException(
        'cardToken é obrigatório para pagamento com cartão',
      );
    }

    const mpResult = await this.mpClient.createCreditCardPayment({
      amount: payment.amount,
      token: extra.cardToken,
      installments: extra.installments ?? 1,
      paymentMethodId: extra.paymentMethodId ?? 'visa',
      description: `Pedido ${order.number ?? order.id}`,
      externalReference: order.id,
      payerEmail,
      payerCpf,
      payerFirstName,
      payerLastName,
    });

    const newStatus = WEBHOOK_STATUS_MAP[mpResult.status] ?? 'PENDING';

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: String(mpResult.id),
        status: newStatus as any,
        cardLastFour: mpResult.cardLastFour,
        installments: extra.installments ?? 1,
        paidAt: newStatus === 'APPROVED' ? new Date() : undefined,
        paidAmount: newStatus === 'APPROVED' ? payment.amount : undefined,
      },
    });

    // Sincronizar status do pedido + estoque
    if (newStatus === 'APPROVED') {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: newStatus as any },
      });
      await this.stockService.confirmReservation(payment.orderId);
    } else if (newStatus === 'FAILED') {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: newStatus as any },
      });
      await this.stockService.releaseStock(payment.orderId, 'PAYMENT_FAILED');
    }

    return updated;
  }

  /**
   * Processa webhook do Mercado Pago com double-check.
   * Busca pagamento na API do MP para confirmar status (não confia apenas no webhook).
   */
  async processWebhook(mpPaymentId: string) {
    // 1. Double-check: buscar pagamento real na API do MP
    let mpPayment;
    try {
      mpPayment = await this.mpClient.getPayment(mpPaymentId);
    } catch {
      // Pagamento não encontrado no MP (ex: ID fictício de simulação)
      this.logger.warn(`Webhook ignorado: pagamento ${mpPaymentId} não encontrado no MP`);
      return;
    }
    const mpStatus = mpPayment.status as string | undefined;
    if (!mpStatus) return;
    const newStatus = WEBHOOK_STATUS_MAP[mpStatus];
    if (!newStatus) return;

    // 2. Encontrar payment local pelo externalId OU external_reference
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { externalId: String(mpPayment.id) },
          { orderId: mpPayment.external_reference as string },
        ],
      },
    });
    if (!payment) return;

    // 3. Idempotência
    if (payment.status === newStatus) return;

    // 4. Verificar que o valor confere (tolerância de R$0.01)
    const mpAmount = mpPayment.transaction_amount ?? 0;
    if (Math.abs(mpAmount - payment.amount) > 0.01) {
      this.logger.error(
        `Webhook valor divergente: MP=${mpAmount}, local=${payment.amount}`,
      );
      return;
    }

    // 5. Atualizar payment
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus as any,
        externalId: String(mpPayment.id),
        paidAt: newStatus === 'APPROVED' ? new Date() : undefined,
        paidAmount: newStatus === 'APPROVED' ? mpAmount : undefined,
        webhookData: JSON.stringify(mpPayment),
      },
    });

    // 6. Sincronizar status do pedido
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: newStatus as any },
    });

    // 7. Atualizar estoque
    if (newStatus === 'APPROVED') {
      await this.stockService.confirmReservation(payment.orderId);
    } else if (newStatus === 'CANCELLED' || newStatus === 'FAILED') {
      await this.stockService.releaseStock(payment.orderId, 'PAYMENT_FAILED');
    }
  }

  async findByOrderId(orderId: string) {
    return this.prisma.payment.findFirst({
      where: { orderId },
    });
  }

  async getPaymentStatus(orderId: string) {
    return this.prisma.payment.findFirst({
      where: { orderId },
      select: {
        id: true,
        orderId: true,
        status: true,
        method: true,
        amount: true,
        discount: true,
        pixQrCode: true,
        pixCopiaECola: true,
        boletoUrl: true,
        boletoBarcode: true,
        expiresAt: true,
        cardLastFour: true,
        installments: true,
        paidAt: true,
      },
    });
  }
}
