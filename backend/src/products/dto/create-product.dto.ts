import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string; // editavel, auto-gera se vazio

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  content?: string; // HTML rich text

  @IsOptional()
  @IsString()
  @IsIn(['simple', 'variable'])
  type?: string;

  // Precos
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  salePrice?: number;

  // Identificadores
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  gtin?: string;

  // Inventario
  @IsOptional()
  @IsBoolean()
  manageStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  weight?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  width?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  height?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  length?: number;

  // Entrega
  @IsOptional()
  @IsInt()
  @Min(0)
  extraDays?: number;

  // Categorizacao
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

  // Atributos: array de attributeValueIds
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

  // Status
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
