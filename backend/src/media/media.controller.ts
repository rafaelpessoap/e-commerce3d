import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Roles('ADMIN')
@Controller('api/v1/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Upload com pipeline: converte para WebP, gera 4 tamanhos, salva no R2 + DB.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return await this.mediaService.processAndUpload(
      file.buffer,
      file.originalname,
      file.mimetype,
      file.size,
    );
  }

  /**
   * Listar galeria (paginado, com busca por filename/alt).
   */
  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
    @Query('search') search?: string,
  ) {
    return await this.mediaService.findAllMedia({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
      search,
    });
  }

  /**
   * Detalhes de uma imagem.
   */
  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.mediaService.findMediaById(id);
  }

  /**
   * Atualizar metadados SEO (alt, title, description).
   */
  @Put(':id')
  async updateMeta(
    @Param('id') id: string,
    @Body() dto: { alt?: string; title?: string; description?: string },
  ) {
    return await this.mediaService.updateMediaMeta(id, dto);
  }

  /**
   * Deletar imagem (4 variantes do R2 + registro DB).
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.mediaService.deleteMediaFile(id);
    return { message: 'Media file deleted' };
  }
}
