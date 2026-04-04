import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEmail,
} from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsIn(['pix', 'boleto', 'credit_card'])
  method: string;

  @IsOptional()
  @IsString()
  cardToken?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  installments?: number;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsEmail()
  payerEmail?: string;

  @IsOptional()
  @IsString()
  payerCpf?: string;

  @IsOptional()
  @IsString()
  payerName?: string;
}
