import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEmail, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';

class OrderItemDto {
  @IsString()
  description!: string;

  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  unitPrice!: number;
}

export class ConfirmReservationDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];
}
