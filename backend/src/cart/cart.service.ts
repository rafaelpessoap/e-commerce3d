import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';

export interface CartItem {
  productId: string;
  variationId?: string;
  variationName?: string;
  scaleId?: string;
  scaleName?: string;
  scalePercentage?: number;
  quantity: number;
  price: number;
  name: string;
  image?: string;
}

interface CartData {
  items: CartItem[];
}

const CART_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const CART_PREFIX = 'cart:';

@Injectable()
export class CartService {
  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
    private scalesService: ScalesService,
  ) {}

  private cartKey(userId: string): string {
    return `${CART_PREFIX}${userId}`;
  }

  private async getCartData(userId: string): Promise<CartData> {
    const data = await this.redis.getJson<CartData>(this.cartKey(userId));
    return data ?? { items: [] };
  }

  private async saveCartData(userId: string, cart: CartData): Promise<void> {
    await this.redis.setJson(this.cartKey(userId), cart, CART_TTL_SECONDS);
  }

  private calculateSubtotal(items: CartItem[]): number {
    return (
      Math.round(
        items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100,
      ) / 100
    );
  }

  /** Match cart item by composite key */
  private itemMatches(
    item: CartItem,
    productId: string,
    variationId?: string,
    scaleId?: string,
  ): boolean {
    return (
      item.productId === productId &&
      (item.variationId ?? undefined) === (variationId ?? undefined) &&
      (item.scaleId ?? undefined) === (scaleId ?? undefined)
    );
  }

  async getCart(userId: string) {
    const cart = await this.getCartData(userId);
    return {
      items: cart.items,
      subtotal: this.calculateSubtotal(cart.items),
    };
  }

  async addItem(
    userId: string,
    dto: {
      productId: string;
      variationId?: string;
      scaleId?: string;
      quantity: number;
    },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    // Resolve base price, variation info
    let basePrice = product.salePrice ?? product.basePrice;
    let variationName: string | undefined;
    let image: string | undefined;

    if (dto.variationId) {
      const variation = await this.prisma.productVariation.findUnique({
        where: { id: dto.variationId },
      });
      if (variation) {
        basePrice = variation.salePrice ?? variation.price;
        variationName = variation.name;
        image = variation.image ?? undefined;
      }
    }

    // Resolve scale pricing
    let finalPrice = basePrice;
    let scaleName: string | undefined;
    let scalePercentage: number | undefined;
    let scaleId = dto.scaleId;

    if (scaleId) {
      const ruleSet = await this.scalesService.resolveScaleRule(dto.productId);
      if (ruleSet) {
        const scaleItem = ruleSet.items.find(
          (i: { scaleId: string }) => i.scaleId === scaleId,
        );
        if (scaleItem) {
          scaleName = (scaleItem as any).scale?.name;
          scalePercentage = scaleItem.percentageIncrease;
          finalPrice = this.scalesService.calculateScalePrice(
            basePrice,
            scaleItem.percentageIncrease,
          );
        }
      }
    }

    const cart = await this.getCartData(userId);

    const existingIndex = cart.items.findIndex((item) =>
      this.itemMatches(item, dto.productId, dto.variationId, scaleId),
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += dto.quantity;
    } else {
      cart.items.push({
        productId: dto.productId,
        variationId: dto.variationId,
        variationName,
        scaleId,
        scaleName,
        scalePercentage,
        quantity: dto.quantity,
        price: finalPrice,
        name: product.name,
        image,
      });
    }

    await this.saveCartData(userId, cart);

    return {
      items: cart.items,
      subtotal: this.calculateSubtotal(cart.items),
    };
  }

  async removeItem(
    userId: string,
    productId: string,
    variationId?: string,
    scaleId?: string,
  ) {
    const cart = await this.getCartData(userId);

    cart.items = cart.items.filter(
      (item) => !this.itemMatches(item, productId, variationId, scaleId),
    );

    await this.saveCartData(userId, cart);

    return {
      items: cart.items,
      subtotal: this.calculateSubtotal(cart.items),
    };
  }

  async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
    variationId?: string,
    scaleId?: string,
  ) {
    const cart = await this.getCartData(userId);

    const item = cart.items.find((i) =>
      this.itemMatches(i, productId, variationId, scaleId),
    );
    if (!item) {
      throw new NotFoundException('Item not found in cart');
    }

    item.quantity = quantity;

    await this.saveCartData(userId, cart);

    return {
      items: cart.items,
      subtotal: this.calculateSubtotal(cart.items),
    };
  }

  async clear(userId: string) {
    await this.redis.del(this.cartKey(userId));
  }
}
