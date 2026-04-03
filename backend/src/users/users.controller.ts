import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('ADMIN')
  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
    @Query('search') search?: string,
  ) {
    return await this.usersService.findAll({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
      search,
    });
  }

  @Get('me')
  async getProfile(@CurrentUser() user: { id: string }) {
    const profile = await this.usersService.getProfile(user.id);
    return { data: profile };
  }

  @Put('me')
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return { data: updated };
  }

  @Put('me/password')
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user.id, dto);
    return { data: { message: 'Password changed successfully' } };
  }
}
