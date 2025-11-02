import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MercadoPagoService } from './services/mercadopago.service';
import { CodiService } from './services/codi.service';
import { SpeiService } from './services/spei.service';
import { MercadoPagoController } from './mercadopago.controller';
import { CodiController } from './codi.controller';
import { SpeiController } from './spei.controller';
import { PaymentsWebhooksController } from './webhooks.controller';

@Module({
  imports: [ConfigModule, PrismaModule, NotificationsModule],
  providers: [MercadoPagoService, CodiService, SpeiService],
  controllers: [MercadoPagoController, CodiController, SpeiController, PaymentsWebhooksController],
  exports: [MercadoPagoService, CodiService, SpeiService],
})
export class PaymentsModule {}
