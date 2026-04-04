import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['simple', 'variable'])
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  salePrice?: number | null;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  gtin?: string;

  @IsOptional()
  @IsBoolean()
  manageStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraDays?: number | null;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attributeValueIds?: string[];

  // Imagens
  @IsOptional()
  @IsArray()
  images?: Array<{
    mediaFileId: string;
    isMain: boolean;
    order: number;
  }>;

  // Variações (para produto type=variable)
  @IsOptional()
  @IsArray()
  variations?: Array<{
    id?: string;
    name: string;
    sku?: string;
    gtin?: string;
    price: number;
    salePrice?: number | null;
    stock?: number;
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
    image?: string;
    scaleId?: string;
  }>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
