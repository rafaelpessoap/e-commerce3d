import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CheckoutLogService } from '../payments/checkout-log.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly checkoutLog: CheckoutLogService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
  ) {
    const start = Date.now();
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];

    try {
      const result = await this.ordersService.createOrder({
        userId: user.id,
        ...dto,
      });

      await this.checkoutLog.log({
        step: 'create_order',
        status: 'success',
        orderId: result.id,
        userId: user.id,
        method: dto.paymentMethod,
        request: {
          items: dto.items,
          paymentMethod: dto.paymentMethod,
          shippingServiceName: dto.shippingServiceName,
        },
        response: {
          orderId: result.id,
          number: result.number,
          subtotal: result.subtotal,
          total: result.total,
        },
        duration: Date.now() - start,
        ip,
        userAgent,
      });

      return result;
    } catch (err) {
      await this.checkoutLog.log({
        step: 'create_order',
        status: 'error',
        userId: user.id,
        method: dto.paymentMethod,
        request: { items: dto.items, paymentMethod: dto.paymentMethod },
        error: err,
        duration: Date.now() - start,
        ip,
        userAgent,
      });
      throw err;
    }
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
