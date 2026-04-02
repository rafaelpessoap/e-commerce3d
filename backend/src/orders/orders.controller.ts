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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(
    @CurrentUser() user: { id: string; role: string },
    @Query('page') page = '1',
    @Query('perPage') perPage = '10',
    @Query('status') status?: string,
  ) {
    // Customer sees only their orders; admin sees all
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
    return { data: await this.ordersService.findById(id) };
  }

  @Roles('ADMIN')
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: { status: string; notes?: string },
  ) {
    return {
      data: await this.ordersService.updateStatus(id, dto.status, user.id),
    };
  }
}
