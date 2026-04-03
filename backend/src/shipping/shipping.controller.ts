import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { MelhorEnvioService, ShippingProduct } from './melhor-envio.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ProductsService } from '../products/products.service';

@Controller('api/v1/shipping')
export class ShippingController {
  constructor(
    private readonly shippingService: ShippingService,
    private readonly melhorEnvioService: MelhorEnvioService,
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Cotação de Frete (público) ─────────────────────────────

  @Public()
  @Post('quote')
  async quote(
    @Body()
    dto: {
      zipCode: string;
      products: Array<{
        productId: string;
        quantity: number;
      }>;
    },
  ) {
    // Buscar dados dos produtos para peso/dimensões + extraDays
    let maxExtraDays = 0;
    const shippingProducts: ShippingProduct[] = [];

    for (const item of dto.products) {
      const product = await this.productsService.findById(item.productId);

      const extraDays = await this.productsService.resolveExtraDays(
        item.productId,
      );
      if (extraDays > maxExtraDays) {
        maxExtraDays = extraDays;
      }

      shippingProducts.push({
        weight: product.weight ?? 0.3, // default 300g
        width: product.width ?? 11,
        height: product.height ?? 5,
        length: product.length ?? 16,
        quantity: item.quantity,
        price: product.salePrice ?? product.basePrice,
      });
    }

    // Verificar frete grátis
    const totalValue = shippingProducts.reduce(
      (sum, p) => sum + p.price * p.quantity,
      0,
    );
    const isFreeShipping = await this.shippingService.checkFreeShipping(
      dto.zipCode,
      totalValue,
    );

    // Cotar no Melhor Envio
    const quotes = await this.melhorEnvioService.getQuotes({
      toCep: dto.zipCode,
      products: shippingProducts,
      extraDays: maxExtraDays,
    });

    return {
      data: {
        quotes,
        freeShipping: isFreeShipping,
        extraDays: maxExtraDays,
      },
    };
  }

  // ─── Simulate free shipping (legacy) ────────────────────────

  @Public()
  @Post('simulate')
  async simulate(@Body() dto: { zipCode: string; orderValue: number }) {
    const isFree = await this.shippingService.checkFreeShipping(
      dto.zipCode,
      dto.orderValue,
    );
    return { data: { freeShipping: isFree } };
  }

  // ─── Admin: Serviços de frete habilitados ───────────────────

  @Roles('ADMIN')
  @Get('methods')
  async getMethods() {
    const allServices = this.melhorEnvioService.getAvailableServices();
    const enabled = await this.melhorEnvioService.getAllMethods();
    const enabledMap = new Map(enabled.map((m) => [m.serviceId, m]));

    // Merge: todos os serviços com status de habilitação
    const merged = allServices.map((svc) => {
      const method = enabledMap.get(svc.id);
      return {
        serviceId: svc.id,
        name: svc.name,
        company: svc.company,
        isActive: method?.isActive ?? false,
        displayName: method?.displayName ?? '',
        extraDays: method?.extraDays ?? 0,
      };
    });

    return { data: merged };
  }

  @Roles('ADMIN')
  @Put('methods/:serviceId')
  async toggleMethod(
    @Param('serviceId') serviceId: string,
    @Body()
    dto: {
      name: string;
      company: string;
      isActive: boolean;
      displayName?: string;
      extraDays?: number;
    },
  ) {
    const result = await this.melhorEnvioService.toggleMethod({
      serviceId: parseInt(serviceId, 10),
      name: dto.name,
      company: dto.company,
      isActive: dto.isActive,
      displayName: dto.displayName,
      extraDays: dto.extraDays,
    });
    return { data: result };
  }

  // ─── Admin: Regras de frete grátis ──────────────────────────

  @Roles('ADMIN')
  @Get('free-rules')
  async findAllRules() {
    return { data: await this.shippingService.findAllFreeShippingRules() };
  }

  @Roles('ADMIN')
  @Post('free-rules')
  async createRule(
    @Body()
    dto: {
      zipCodeStart: string;
      zipCodeEnd: string;
      minOrderValue: number;
    },
  ) {
    return { data: await this.shippingService.createFreeShippingRule(dto) };
  }

  @Roles('ADMIN')
  @Put('free-rules/:id')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: { minOrderValue?: number; isActive?: boolean },
  ) {
    return { data: await this.shippingService.updateFreeShippingRule(id, dto) };
  }

  // ─── Admin: Configurações de frete ──────────────────────────

  @Roles('ADMIN')
  @Get('settings')
  async getSettings() {
    const cep = await this.prisma.setting
      .findUnique({ where: { key: 'shop_cep' } })
      .catch(() => null);
    return {
      data: {
        shopCep: cep?.value ?? '',
      },
    };
  }

  @Roles('ADMIN')
  @Put('settings')
  async updateSettings(@Body() dto: { shopCep: string }) {
    await this.prisma.setting.upsert({
      where: { key: 'shop_cep' },
      create: { key: 'shop_cep', value: dto.shopCep.replace(/\D/g, '') },
      update: { value: dto.shopCep.replace(/\D/g, '') },
    });
    return { data: { shopCep: dto.shopCep.replace(/\D/g, '') } };
  }
}
