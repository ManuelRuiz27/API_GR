import { IsObject, IsOptional, IsString } from 'class-validator';

type WebhookData = {
  id?: string;
};

export class MercadoPagoWebhookDto {
  @IsString()
  type!: string;

  @IsObject()
  data!: WebhookData;

  @IsOptional()
  @IsString()
  action?: string;
}
