import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ConfirmSpeiPaymentDto {
  @IsString()
  reference!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
