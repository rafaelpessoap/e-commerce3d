import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return { data: await this.wishlistService.findAll(user.id) };
  }

  @Post(':productId')
  async add(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
  ) {
    return { data: await this.wishlistService.add(user.id, productId) };
  }

  @Delete(':productId')
  async remove(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
  ) {
    await this.wishlistService.remove(user.id, productId);
    return { data: { message: 'Removed from wishlist' } };
  }
}
