import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PaymentProvider, PaymentStatus, OrderStatus, Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateMercadoPagoPreferenceDto } from '../dto/create-mercadopago-preference.dto';
import { MercadoPagoWebhookDto } from '../dto/mercadopago-webhook.dto';

@Injectable()
export class MercadoPagoService {
  private readonly preferenceClient?: Preference;
  private readonly paymentClient?: Payment;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (accessToken) {
      const client = new MercadoPagoConfig({ accessToken });
      this.preferenceClient = new Preference(client);
      this.paymentClient = new Payment(client);
    }
  }

  private ensurePreference(): Preference {
    if (!this.preferenceClient) {
      throw new InternalServerErrorException('MercadoPago SDK not configured');
    }
    return this.preferenceClient;
  }

  private ensurePayment(): Payment {
    if (!this.paymentClient) {
      throw new InternalServerErrorException('MercadoPago SDK not configured');
    }
    return this.paymentClient;
  }

  async createPreference(dto: CreateMercadoPagoPreferenceDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const preferenceBody = {
      items: order.items.length
        ? order.items.map((item) => ({
            title: item.description,
            quantity: item.quantity,
            unit_price: Number(item.unitPrice),
            currency_id: order.currency,
          }))
        : [
            {
              title: 'Reservation',
              quantity: 1,
              unit_price: Number(order.totalAmount),
              currency_id: order.currency,
            },
          ],
      back_urls: {
        success: dto.successUrl,
        failure: dto.failureUrl,
        pending: dto.successUrl,
      },
      external_reference: order.id,
    };

    const response = await this.ensurePreference().create({ body: preferenceBody });

    const preferenceId = response.id ?? response.body?.id;
    const initPoint = response.init_point ?? response.body?.init_point;
    const sandboxInitPoint = response.sandbox_init_point ?? response.body?.sandbox_init_point;

    if (!preferenceId) {
      throw new InternalServerErrorException('MercadoPago did not return a preference id');
    }

    const attempt = await this.prisma.$transaction(async (tx) => {
      const paymentAttempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.MERCADOPAGO,
          status: PaymentStatus.PENDING,
          amount: order.totalAmount,
          metadata: {
            preferenceId,
          },
        },
      });

      await tx.mercadoPagoPayment.create({
        data: {
          paymentAttemptId: paymentAttempt.id,
          preferenceId,
          initPoint: initPoint ?? null,
          sandboxInitPoint: sandboxInitPoint ?? null,
          status: 'pending',
          rawResponse: response as unknown as Prisma.JsonValue,
        },
      });

      return paymentAttempt;
    });

    await this.notifications.emit('payment-status', {
      orderId: order.id,
      provider: PaymentProvider.MERCADOPAGO,
      status: PaymentStatus.PENDING,
      preferenceId,
    });

    return {
      preferenceId,
      initPoint,
      sandboxInitPoint,
      paymentAttemptId: attempt.id,
    };
  }

  async getPaymentStatus(paymentId: string) {
    const response = await this.ensurePayment().get({ id: paymentId });
    const status = this.mapStatus(response.status ?? response.body?.status ?? 'pending');

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { externalId: paymentId },
    });

    if (attempt && attempt.status !== status) {
      await this.updateAttemptStatus(attempt.id, status, response);
    }

    return response;
  }

  async handleWebhook(dto: MercadoPagoWebhookDto, signature?: string) {
    this.verifySignature(dto, signature);

    const paymentId = dto.data.id;
    if (!paymentId) {
      throw new BadRequestException('Missing payment id in webhook');
    }

    const payment = await this.ensurePayment().get({ id: paymentId });
    const status = this.mapStatus(payment.status ?? payment.body?.status ?? 'pending');

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { externalId: paymentId },
    });

    if (!attempt) {
      const orderId = payment.external_reference ?? payment.body?.external_reference;
      if (!orderId) {
        return { processed: false };
      }

      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return { processed: false };
      }

      await this.prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.MERCADOPAGO,
          status,
          externalId: paymentId,
          metadata: payment as unknown as Prisma.JsonValue,
        },
      });
      await this.notifications.emit('payment-status', {
        orderId: order.id,
        provider: PaymentProvider.MERCADOPAGO,
        status,
      });
      return { processed: true };
    }

    if (attempt.status === status) {
      return { processed: false };
    }

    await this.updateAttemptStatus(attempt.id, status, payment);

    return { processed: true };
  }

  private async updateAttemptStatus(attemptId: string, status: PaymentStatus, payload: unknown) {
    const attempt = await this.prisma.paymentAttempt.update({
      where: { id: attemptId },
      data: {
        status,
        metadata: payload as unknown as Prisma.JsonValue,
      },
      include: { order: true },
    });

    if (status === PaymentStatus.SUCCEEDED) {
      await this.prisma.order.update({
        where: { id: attempt.orderId },
        data: { status: OrderStatus.PAID },
      });
    }

    await this.notifications.emit('payment-status', {
      orderId: attempt.orderId,
      provider: PaymentProvider.MERCADOPAGO,
      status,
    });
  }

  private mapStatus(status: string): PaymentStatus {
    switch (status) {
      case 'approved':
      case 'success':
        return PaymentStatus.SUCCEEDED;
      case 'rejected':
      case 'cancelled':
        return PaymentStatus.FAILED;
      case 'pending':
      default:
        return PaymentStatus.PENDING;
    }
  }

  private verifySignature(dto: MercadoPagoWebhookDto, signature?: string) {
    const secret = this.config.get<string>('MERCADOPAGO_WEBHOOK_SECRET');
    if (!secret) {
      return;
    }
    if (!signature) {
      throw new UnauthorizedException('Missing MercadoPago signature');
    }
    const expected = createHmac('sha256', secret).update(JSON.stringify(dto)).digest('hex');
    if (expected !== signature) {
      throw new UnauthorizedException('Invalid MercadoPago signature');
    }
  }
}
