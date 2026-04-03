import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  mailConfig,
  storageConfig,
} from './config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { BrandsModule } from './brands/brands.module';
import { ScalesModule } from './scales/scales.module';
import { ProductsModule } from './products/products.module';
import { CouponsModule } from './coupons/coupons.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { ShippingModule } from './shipping/shipping.module';
import { PaymentsModule } from './payments/payments.module';
import { BundlesModule } from './bundles/bundles.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { EmailModule } from './email/email.module';
import { AdminModule } from './admin/admin.module';
import { SearchModule } from './search/search.module';
import { MediaModule } from './media/media.module';
import { SeoModule } from './seo/seo.module';
import { BlogModule } from './blog/blog.module';
import { PagesModule } from './pages/pages.module';
import { AttributesModule } from './attributes/attributes.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, mailConfig, storageConfig],
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    PrismaModule,
    RedisModule,
    // Fase 1 — Autenticação
    AuthModule,
    UsersModule,
    AddressesModule,
    // Fase 2 — Catálogo
    CategoriesModule,
    TagsModule,
    BrandsModule,
    ScalesModule,
    ProductsModule,
    // Fase 3 — Checkout
    CouponsModule,
    CartModule,
    OrdersModule,
    ShippingModule,
    PaymentsModule,
    BundlesModule,
    // Fase 4 — Pós-venda
    WishlistModule,
    EmailModule,
    // Fase 5 — Admin
    AdminModule,
    // Fase 6 — Busca + Media + SEO + Blog
    SearchModule,
    MediaModule,
    SeoModule,
    BlogModule,
    PagesModule,
    AttributesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
