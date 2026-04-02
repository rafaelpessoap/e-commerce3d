import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateOrderDto,
  ) {
    return await this.ordersService.createOrder({
      userId: user.id,
      ...dto,
    });
  }

  @Get()
  async findAll(
    @CurrentUser() user: { id: string; role: string },
    @Query('page') page = '1',
    @Query('perPage') perPage = '10',
    @Query('status') status?: string,
  ) {
    const userId = user.role === 'ADMIN' ? undefined : user.id;
    return await this.ordersService.findAll({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
      userId,
      status,
    });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.ordersService.findById(id);
  }

  @Roles('ADMIN')
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return await this.ordersService.updateStatus(id, dto.status, user.id);
  }

  @Public()
  @Get('track/:orderNumber')
  async track(@Param('orderNumber') orderNumber: string) {
    return await this.ordersService.trackByNumber(orderNumber);
  }
}
