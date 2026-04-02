import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'postalCode must be exactly 8 digits' })
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  street!: string;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complement?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  neighborhood!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  state!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
