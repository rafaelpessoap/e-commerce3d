import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7: url removed from schema (prisma.config.ts handles CLI).
    // Runtime needs datasourceUrl passed via constructor.
    // Using 'as any' because prisma-client-js types don't expose datasourceUrl
    // but the runtime accepts it (documented in Prisma 7 migration guide).
    const url = process.env.DATABASE_URL;
    super(url ? ({ datasourceUrl: url } as any) : {});
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
