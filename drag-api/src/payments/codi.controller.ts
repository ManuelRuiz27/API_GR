import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CodiService } from './services/codi.service';
import { CreateCodiChargeDto } from './dto/create-codi-charge.dto';

@Controller('api/codi')
export class CodiController {
  constructor(private readonly service: CodiService) {}

  @Post('qr')
  create(@Body() dto: CreateCodiChargeDto) {
    return this.service.createCharge(dto);
  }

  @Get('charges/:codiId')
  get(@Param('codiId') codiId: string) {
    return this.service.getCharge(codiId);
  }
}
