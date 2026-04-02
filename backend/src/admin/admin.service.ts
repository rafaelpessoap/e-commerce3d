import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [totalOrders, revenueResult, totalUsers, totalProducts] =
      await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.aggregate({ _sum: { total: true } }),
        this.prisma.user.count(),
        this.prisma.product.count({ where: { isActive: true } }),
      ]);

    return {
      totalOrders,
      totalRevenue: revenueResult._sum.total ?? 0,
      totalUsers,
      totalProducts,
    };
  }

  async getOrdersByStatus() {
    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return grouped.map((g) => ({
      status: g.status,
      count: g._count._all,
    }));
  }
}
