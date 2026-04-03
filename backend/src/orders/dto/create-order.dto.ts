import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variationId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @IsPositive()
  price!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsNumber()
  @IsPositive()
  subtotal!: number;

  @IsNumber()
  @Min(0)
  shipping!: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsNumber()
  @IsPositive()
  total!: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  shippingServiceName?: string;

  @IsOptional()
  @IsString()
  couponId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
