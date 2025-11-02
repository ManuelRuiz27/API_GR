import { Body, Controller, Headers, Post } from '@nestjs/common';
import { MercadoPagoService } from './services/mercadopago.service';
import { CodiService } from './services/codi.service';
import { MercadoPagoWebhookDto } from './dto/mercadopago-webhook.dto';
import { CodiWebhookDto } from './dto/codi-webhook.dto';

@Controller('api/webhooks')
export class PaymentsWebhooksController {
  constructor(private readonly mercadoPago: MercadoPagoService, private readonly codi: CodiService) {}

  @Post('mercadopago')
  mercadoPagoWebhook(@Body() dto: MercadoPagoWebhookDto, @Headers('x-signature') signature?: string) {
    return this.mercadoPago.handleWebhook(dto, signature);
  }

  @Post('codi')
  codiWebhook(@Body() dto: CodiWebhookDto) {
    return this.codi.handleWebhook(dto);
  }
}
