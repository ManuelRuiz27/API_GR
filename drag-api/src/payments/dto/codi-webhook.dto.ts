import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CodiWebhookDto {
  @IsString()
  codiId!: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;
}
