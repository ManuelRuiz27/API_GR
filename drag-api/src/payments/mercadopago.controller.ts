import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MercadoPagoService } from './services/mercadopago.service';
import { CreateMercadoPagoPreferenceDto } from './dto/create-mercadopago-preference.dto';

@Controller('api/mercadopago')
export class MercadoPagoController {
  constructor(private readonly service: MercadoPagoService) {}

  @Post('preferences')
  createPreference(@Body() dto: CreateMercadoPagoPreferenceDto) {
    return this.service.createPreference(dto);
  }

  @Get('payments/:id')
  getPayment(@Param('id') id: string) {
    return this.service.getPaymentStatus(id);
  }
}
