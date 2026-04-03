import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews')
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: { productId: string; orderId: string; rating: number; comment?: string; images?: string },
  ) {
    return await this.reviewsService.create({ userId: user.id, ...dto });
  }

  @Public()
  @Get('products/:productId/reviews')
  async findByProduct(@Param('productId') productId: string) {
    const [reviews, rating] = await Promise.all([
      this.reviewsService.findByProduct(productId),
      this.reviewsService.getAverageRating(productId),
    ]);
    return { reviews, ...rating };
  }

  @Roles('ADMIN')
  @Get('reviews/admin')
  async findAllAdmin() {
    return await this.reviewsService.findAllAdmin();
  }

  @Roles('ADMIN')
  @Put('reviews/:id/approve')
  async approve(@Param('id') id: string) {
    const review = await this.reviewsService.approve(id);
    // Generate reward coupon
    const reward = await this.reviewsService.generateReward(id, review.userId);
    return { review, reward };
  }
}
