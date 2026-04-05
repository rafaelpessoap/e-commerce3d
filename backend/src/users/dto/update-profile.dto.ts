import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve ter 11 dígitos numéricos' })
  cpf?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Telefone deve ter 10 ou 11 dígitos numéricos' })
  phone?: string;
}
