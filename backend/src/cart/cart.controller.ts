import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: { id: string }) {
    return { data: await this.cartService.getCart(user.id) };
  }

  @Post('items')
  async addItem(
    @CurrentUser() user: { id: string },
    @Body() dto: { productId: string; variationId?: string; quantity: number },
  ) {
    return { data: await this.cartService.addItem(user.id, dto) };
  }

  @Put('items/:productId')
  async updateQuantity(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
    @Body() dto: { quantity: number },
  ) {
    return {
      data: await this.cartService.updateQuantity(user.id, productId, dto.quantity),
    };
  }

  @Delete('items/:productId')
  async removeItem(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
  ) {
    return { data: await this.cartService.removeItem(user.id, productId) };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clear(@CurrentUser() user: { id: string }) {
    await this.cartService.clear(user.id);
    return { data: { message: 'Cart cleared' } };
  }
}
