import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SpeiService } from './services/spei.service';
import { CreateSpeiReferenceDto } from './dto/create-spei-reference.dto';
import { ConfirmSpeiPaymentDto } from './dto/confirm-spei-payment.dto';

@Controller('api/spei')
export class SpeiController {
  constructor(private readonly service: SpeiService) {}

  @Post('references')
  create(@Body() dto: CreateSpeiReferenceDto) {
    return this.service.createReference(dto);
  }

  @Post('confirmations')
  confirm(@Body() dto: ConfirmSpeiPaymentDto) {
    return this.service.confirm(dto);
  }

  @Get('receipts/:reference')
  getReceipt(@Param('reference') reference: string) {
    return this.service.getReceipt(reference);
  }
}
