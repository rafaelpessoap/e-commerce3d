import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Public()
@Controller('api/v1/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private getCartKey(
    user: { id: string } | undefined,
    sessionId: string | undefined,
  ): string {
    if (user?.id) return user.id;
    if (sessionId) return `anon:${sessionId}`;
    throw new Error('Either login or provide x-session-id header');
  }

  @Get()
  async getCart(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const key = this.getCartKey(user, sessionId);
    return { data: await this.cartService.getCart(key) };
  }

  @Post('items')
  async addItem(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body()
    dto: {
      productId: string;
      variationId?: string;
      scaleId?: string;
      quantity: number;
    },
  ) {
    const key = this.getCartKey(user, sessionId);
    return { data: await this.cartService.addItem(key, dto) };
  }

  @Put('items/:productId')
  async updateQuantity(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('productId') productId: string,
    @Query('variationId') variationId?: string,
    @Query('scaleId') scaleId?: string,
    @Body() dto?: { quantity: number },
  ) {
    const key = this.getCartKey(user, sessionId);
    return {
      data: await this.cartService.updateQuantity(
        key,
        productId,
        dto!.quantity,
        variationId,
        scaleId,
      ),
    };
  }

  @Delete('items/:productId')
  async removeItem(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('productId') productId: string,
    @Query('variationId') variationId?: string,
    @Query('scaleId') scaleId?: string,
  ) {
    const key = this.getCartKey(user, sessionId);
    return {
      data: await this.cartService.removeItem(key, productId, variationId, scaleId),
    };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clear(
    @CurrentUser() user: { id: string } | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const key = this.getCartKey(user, sessionId);
    await this.cartService.clear(key);
    return { data: { message: 'Cart cleared' } };
  }

  @Post('merge')
  async mergeCart(
    @CurrentUser() user: { id: string },
    @Body() dto: { sessionId: string },
  ) {
    if (!user?.id) return { data: { merged: false } };
    const anonKey = `anon:${dto.sessionId}`;
    const anonCart = await this.cartService.getCart(anonKey);

    if (anonCart.items.length > 0) {
      for (const item of anonCart.items) {
        await this.cartService.addItem(user.id, {
          productId: item.productId,
          variationId: item.variationId,
          scaleId: item.scaleId,
          quantity: item.quantity,
        });
      }
      await this.cartService.clear(anonKey);
    }

    const userCart = await this.cartService.getCart(user.id);
    return { data: { merged: true, cart: userCart } };
  }
}
