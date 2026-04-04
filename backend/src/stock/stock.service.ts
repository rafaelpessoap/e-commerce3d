import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface StockItem {
  productId: string;
  variationId?: string;
  quantity: number;
}

interface AdjustStockParams {
  productId: string;
  variationId?: string;
  delta: number;
  adminUserId: string;
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Reserve stock when order is created (PENDING).
   * Does NOT decrement stock — only increments reservedStock.
   * Available = stock - reservedStock.
   */
  async reserveStock(orderId: string, items: StockItem[]) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product || !product.manageStock) continue;

        if (item.variationId) {
          const variation = await tx.productVariation.findUnique({
            where: { id: item.variationId },
          });
          if (!variation) continue;

          const available = variation.stock - variation.reservedStock;
          if (available < item.quantity) {
            throw new BadRequestException(
              `Estoque insuficiente para "${product.name}" (disponível: ${available}, solicitado: ${item.quantity})`,
            );
          }

          await tx.productVariation.update({
            where: { id: item.variationId },
            data: { reservedStock: { increment: item.quantity } },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            variationId: item.variationId,
            quantityBefore: variation.stock,
            quantityAfter: variation.stock,
            delta: 0,
            reservedBefore: variation.reservedStock,
            reservedAfter: variation.reservedStock + item.quantity,
            reason: 'ORDER_RESERVED',
            referenceId: orderId,
          });
        } else {
          const available = product.stock - product.reservedStock;
          if (available < item.quantity) {
            throw new BadRequestException(
              `Estoque insuficiente para "${product.name}" (disponível: ${available}, solicitado: ${item.quantity})`,
            );
          }

          await tx.product.update({
            where: { id: item.productId },
            data: { reservedStock: { increment: item.quantity } },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            quantityBefore: product.stock,
            quantityAfter: product.stock,
            delta: 0,
            reservedBefore: product.reservedStock,
            reservedAfter: product.reservedStock + item.quantity,
            reason: 'ORDER_RESERVED',
            referenceId: orderId,
          });
        }
      }

      // Mark order as having reserved stock
      await tx.order.update({
        where: { id: orderId },
        data: { stockReserved: true },
      });
    });
  }

  /**
   * Confirm reservation when payment is APPROVED.
   * Decrements both stock and reservedStock.
   */
  async confirmReservation(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order?.stockReserved) return; // idempotent

      const items = await tx.orderItem.findMany({
        where: { orderId },
        include: { product: true },
      });

      for (const item of items) {
        if (!item.product.manageStock) continue;

        if (item.variationId) {
          const variation = await tx.productVariation.findUnique({
            where: { id: item.variationId },
          });
          if (!variation) continue;

          await tx.productVariation.update({
            where: { id: item.variationId },
            data: {
              stock: { decrement: item.quantity },
              reservedStock: { decrement: item.quantity },
            },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            variationId: item.variationId,
            quantityBefore: variation.stock,
            quantityAfter: variation.stock - item.quantity,
            delta: -item.quantity,
            reservedBefore: variation.reservedStock,
            reservedAfter: variation.reservedStock - item.quantity,
            reason: 'ORDER_CONFIRMED',
            referenceId: orderId,
          });
        } else {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) continue;

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              reservedStock: { decrement: item.quantity },
            },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            quantityBefore: product.stock,
            quantityAfter: product.stock - item.quantity,
            delta: -item.quantity,
            reservedBefore: product.reservedStock,
            reservedAfter: product.reservedStock - item.quantity,
            reason: 'ORDER_CONFIRMED',
            referenceId: orderId,
          });
        }
      }

      // Mark reservation as consumed
      await tx.order.update({
        where: { id: orderId },
        data: { stockReserved: false },
      });
    });
  }

  /**
   * Release reserved stock on cancellation or payment failure.
   * Decrements reservedStock only (stock was never decremented).
   */
  async releaseStock(
    orderId: string,
    reason: 'ORDER_CANCELLED' | 'PAYMENT_FAILED',
  ) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order?.stockReserved) return; // idempotent

      const items = await tx.orderItem.findMany({
        where: { orderId },
        include: { product: true },
      });

      for (const item of items) {
        if (!item.product.manageStock) continue;

        if (item.variationId) {
          const variation = await tx.productVariation.findUnique({
            where: { id: item.variationId },
          });
          if (!variation) continue;

          await tx.productVariation.update({
            where: { id: item.variationId },
            data: { reservedStock: { decrement: item.quantity } },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            variationId: item.variationId,
            quantityBefore: variation.stock,
            quantityAfter: variation.stock,
            delta: 0,
            reservedBefore: variation.reservedStock,
            reservedAfter: variation.reservedStock - item.quantity,
            reason,
            referenceId: orderId,
          });
        } else {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) continue;

          await tx.product.update({
            where: { id: item.productId },
            data: { reservedStock: { decrement: item.quantity } },
          });

          await this.createAuditLog(tx, {
            productId: item.productId,
            quantityBefore: product.stock,
            quantityAfter: product.stock,
            delta: 0,
            reservedBefore: product.reservedStock,
            reservedAfter: product.reservedStock - item.quantity,
            reason,
            referenceId: orderId,
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { stockReserved: false },
      });
    });
  }

  /**
   * Admin manual stock adjustment.
   */
  async adjustStock(params: AdjustStockParams) {
    await this.prisma.$transaction(async (tx) => {
      if (params.variationId) {
        const variation = await tx.productVariation.findUnique({
          where: { id: params.variationId },
        });
        if (!variation) throw new BadRequestException('Variação não encontrada');

        const updated = await tx.productVariation.update({
          where: { id: params.variationId },
          data: { stock: { increment: params.delta } },
        });

        await this.createAuditLog(tx, {
          productId: params.productId,
          variationId: params.variationId,
          quantityBefore: variation.stock,
          quantityAfter: updated.stock,
          delta: params.delta,
          reason: 'ADMIN_ADJUSTMENT',
          referenceId: params.adminUserId,
        });
      } else {
        const product = await tx.product.findUnique({
          where: { id: params.productId },
        });
        if (!product) throw new BadRequestException('Produto não encontrado');

        const updated = await tx.product.update({
          where: { id: params.productId },
          data: { stock: { increment: params.delta } },
        });

        await this.createAuditLog(tx, {
          productId: params.productId,
          quantityBefore: product.stock,
          quantityAfter: updated.stock,
          delta: params.delta,
          reason: 'ADMIN_ADJUSTMENT',
          referenceId: params.adminUserId,
        });
      }
    });
  }

  /**
   * Get available stock (stock - reservedStock).
   */
  getAvailableStock(stock: number, reservedStock: number): number {
    return Math.max(0, stock - reservedStock);
  }

  /**
   * Get last 30 audit log entries for a product/variation.
   */
  async getAuditLog(productId: string, variationId?: string) {
    return this.prisma.stockAuditLog.findMany({
      where: {
        productId,
        ...(variationId ? { variationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  /**
   * Check if stock is below threshold and log warning.
   * Called after confirmReservation and adjustStock.
   */
  async checkLowStock(productId: string, variationId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    }) as any;
    if (!product?.manageStock) return;

    const globalSetting = await this.prisma.setting.findUnique({
      where: { key: 'low_stock_threshold' },
    } as any);
    const threshold =
      product.lowStockThreshold ?? parseInt(globalSetting?.value ?? '5', 10);

    let currentStock: number;
    let itemName = product.name;

    if (variationId) {
      const variation = await this.prisma.productVariation.findUnique({
        where: { id: variationId },
      }) as any;
      currentStock = variation?.stock ?? 0;
      itemName = `${product.name} - ${variation?.name ?? variationId}`;
    } else {
      currentStock = product.stock;
    }

    if (currentStock <= threshold) {
      this.logger.warn(
        `LOW STOCK: "${itemName}" — ${currentStock} unidades (threshold: ${threshold})`,
      );
      return { isLow: true, currentStock, threshold, productName: itemName };
    }

    return { isLow: false, currentStock, threshold };
  }

  /**
   * Find products with low or zero stock (admin filter).
   */
  async findLowStockProducts(page = 1, perPage = 20) {
    const globalSetting = await this.prisma.setting.findUnique({
      where: { key: 'low_stock_threshold' },
    } as any);
    const globalThreshold = parseInt(globalSetting?.value ?? '5', 10);

    // Products where stock <= their threshold (or global if null)
    const products = await this.prisma.product.findMany({
      where: {
        manageStock: true,
        isActive: true,
        type: 'simple',
      },
      include: { category: true },
      orderBy: { stock: 'asc' },
    });

    const lowStock = products.filter((p: any) => {
      const threshold = p.lowStockThreshold ?? globalThreshold;
      return p.stock <= threshold;
    });

    const start = (page - 1) * perPage;
    const paginated = lowStock.slice(start, start + perPage);

    // Also check variations
    const variations = await this.prisma.productVariation.findMany({
      where: {
        product: { manageStock: true, isActive: true, type: 'variable' },
      },
      include: { product: true, scale: true },
      orderBy: { stock: 'asc' },
    });

    const lowStockVariations = variations.filter((v: any) => {
      const threshold = v.product.lowStockThreshold ?? globalThreshold;
      return v.stock <= threshold;
    });

    return {
      products: paginated.map((p: any) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        reservedStock: p.reservedStock,
        available: p.stock - p.reservedStock,
        threshold: p.lowStockThreshold ?? globalThreshold,
        category: p.category?.name,
      })),
      variations: lowStockVariations.slice(start, start + perPage).map((v: any) => ({
        id: v.id,
        productId: v.productId,
        productName: v.product.name,
        variationName: v.name,
        stock: v.stock,
        reservedStock: v.reservedStock,
        available: v.stock - v.reservedStock,
        threshold: v.product.lowStockThreshold ?? globalThreshold,
      })),
      total: lowStock.length + lowStockVariations.length,
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────

  private async createAuditLog(
    tx: any,
    data: {
      productId: string;
      variationId?: string;
      quantityBefore: number;
      quantityAfter: number;
      delta: number;
      reservedBefore?: number;
      reservedAfter?: number;
      reason: string;
      referenceId?: string;
    },
  ) {
    await tx.stockAuditLog.create({ data });

    // Prune: keep only last 30 per product/variation
    const where = data.variationId
      ? { productId: data.productId, variationId: data.variationId }
      : { productId: data.productId, variationId: null };

    const old = await tx.stockAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' as const },
      skip: 30,
      select: { id: true },
    });

    if (old.length > 0) {
      await tx.stockAuditLog.deleteMany({
        where: { id: { in: old.map((l: { id: string }) => l.id) } },
      });
    }
  }
}
