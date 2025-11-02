import { IsString, IsUUID } from 'class-validator';

export class CreateMercadoPagoPreferenceDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  successUrl!: string;

  @IsString()
  failureUrl!: string;
}
