import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CartItem {
  productId: string;
  variationId?: string;
  quantity: number;
  price: number;
  name: string;
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

  async getCart(userId: string) {
    const cart = await this.getCartData(userId);
    return {
      items: cart.items,
      subtotal: this.calculateSubtotal(cart.items),
    };
  }

  async addItem(
    userId: string,
    dto: { productId: string; variationId?: string; quantity: number },
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

    const cart = await this.getCartData(userId);

    const existingIndex = cart.items.findIndex(
      (item) =>
        item.productId === dto.productId &&
        item.variationId === dto.variationId,
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += dto.quantity;
    } else {
      cart.items.push({
        productId: dto.productId,
        variationId: dto.variationId,
        quantity: dto.quantity,
        price: product.basePrice,
        name: product.name,
      });
    }

    await this.saveCartData(userId, cart);

    return {
      items: cart.items,
      subtotal: this.calculateSubtotal(cart.items),
    };
  }

  async removeItem(userId: string, productId: string, variationId?: string) {
    const cart = await this.getCartData(userId);

    cart.items = cart.items.filter(
      (item) =>
        !(item.productId === productId && item.variationId === variationId),
    );

    await this.saveCartData(userId, cart);

    return {
      items: cart.items,
      subtotal: this.calculateSubtotal(cart.items),
    };
  }

  async updateQuantity(userId: string, productId: string, quantity: number) {
    const cart = await this.getCartData(userId);

    const item = cart.items.find((i) => i.productId === productId);
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
