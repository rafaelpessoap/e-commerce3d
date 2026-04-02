import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
