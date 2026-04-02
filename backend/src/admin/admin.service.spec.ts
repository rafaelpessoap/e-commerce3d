import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              count: jest.fn(),
              aggregate: jest.fn(),
              groupBy: jest.fn(),
            },
            user: {
              count: jest.fn(),
            },
            product: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getDashboardStats', () => {
    it('should return all dashboard metrics', async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(150);
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { total: 15000.5 },
      });
      (prisma.user.count as jest.Mock).mockResolvedValue(85);
      (prisma.product.count as jest.Mock).mockResolvedValue(42);

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        totalOrders: 150,
        totalRevenue: 15000.5,
        totalUsers: 85,
        totalProducts: 42,
      });
    });
  });

  describe('getOrdersByStatus', () => {
    it('should return order counts grouped by status', async () => {
      (prisma.order.groupBy as jest.Mock).mockResolvedValue([
        { status: 'PENDING', _count: { _all: 10 } },
        { status: 'CONFIRMED', _count: { _all: 5 } },
        { status: 'DELIVERED', _count: { _all: 30 } },
      ]);

      const result = await service.getOrdersByStatus();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ status: 'PENDING', count: 10 });
    });
  });
});
