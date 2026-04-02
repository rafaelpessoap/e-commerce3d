import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7: url removed from schema (prisma.config.ts handles CLI).
    // Runtime prisma-client-js still accepts datasources.db.url in constructor.
    const url = process.env.DATABASE_URL;
    super(
      url
        ? ({ datasources: { db: { url } } } as any)
        : {},
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
