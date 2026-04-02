import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Descontos configuráveis por método de pagamento
const METHOD_DISCOUNTS: Record<string, number> = {
  pix: 10, // 10%
  boleto: 5, // 5%
  credit_card: 0,
  debit_card: 0,
};

const WEBHOOK_STATUS_MAP: Record<string, string> = {
  approved: 'APPROVED',
  pending: 'PENDING',
  rejected: 'FAILED',
  cancelled: 'CANCELLED',
};

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  calculateMethodDiscount(method: string, amount: number): number {
    const percentage = METHOD_DISCOUNTS[method] ?? 0;
    return Math.round(amount * (percentage / 100) * 100) / 100;
  }

  async createPayment(orderId: string, method: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const discount = this.calculateMethodDiscount(method, order.total);
    const amount = Math.round((order.total - discount) * 100) / 100;

    return this.prisma.payment.create({
      data: {
        orderId,
        method,
        amount,
        discount,
        status: 'PENDING',
      },
    });
  }

  async processWebhook(data: { externalId: string; status: string }) {
    const payment = await this.prisma.payment.findUnique({
      where: { externalId: data.externalId },
    });

    // Ignora IDs desconhecidos
    if (!payment) return;

    const newStatus = WEBHOOK_STATUS_MAP[data.status];
    if (!newStatus) return;

    // Idempotência: não reprocessar se já está no status final
    if (payment.status === newStatus) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus as any,
        paidAt: newStatus === 'APPROVED' ? new Date() : undefined,
      },
    });

    // Atualizar status de pagamento do pedido
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: newStatus as any },
    });
  }

  async findByOrderId(orderId: string) {
    return this.prisma.payment.findUnique({
      where: { orderId } as any,
    });
  }
}
