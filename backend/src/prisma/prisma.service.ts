import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7: schema has no url (uses prisma.config.ts for CLI/migrations).
    // Runtime needs url via constructor — prisma-client-js accepts datasources.db.url
    const url = process.env.DATABASE_URL;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(url ? ({ datasources: { db: { url } } } as any) : {});
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
