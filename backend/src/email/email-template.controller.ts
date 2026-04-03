import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/email-templates')
export class EmailTemplateController {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return this.emailTemplateService.findAll();
  }

  @Roles('ADMIN')
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.emailTemplateService.findByType(id);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { subject?: string; htmlBody?: string },
  ) {
    return this.emailTemplateService.update(id, body);
  }
}
