import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, OrderStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateCodiChargeDto } from '../dto/create-codi-charge.dto';
import { CodiWebhookDto } from '../dto/codi-webhook.dto';

@Injectable()
export class CodiService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async createCharge(dto: CreateCodiChargeDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const codiId = randomUUID();
    const qrData = `CODI:${codiId}`;

    const attempt = await this.prisma.$transaction(async (tx) => {
      const paymentAttempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.CODI,
          status: PaymentStatus.PENDING,
          amount: order.totalAmount,
        },
      });

      await tx.codiCharge.create({
        data: {
          paymentAttemptId: paymentAttempt.id,
          codiId,
          qrData,
          status: 'pending',
        },
      });

      return paymentAttempt;
    });

    await this.notifications.emit('codi-status', {
      orderId: order.id,
      codiId,
      status: 'pending',
      qrData,
    });

    await this.notifications.emit('payment-status', {
      orderId: order.id,
      provider: PaymentProvider.CODI,
      status: PaymentStatus.PENDING,
    });

    return { codiId, qrData, paymentAttemptId: attempt.id };
  }

  async getCharge(codiId: string) {
    const charge = await this.prisma.codiCharge.findUnique({
      where: { codiId },
      include: {
        paymentAttempt: true,
      },
    });

    if (!charge) {
      throw new NotFoundException('Charge not found');
    }

    return charge;
  }

  async handleWebhook(dto: CodiWebhookDto) {
    const charge = await this.prisma.codiCharge.findUnique({
      where: { codiId: dto.codiId },
      include: {
        paymentAttempt: true,
      },
    });

    if (!charge) {
      throw new NotFoundException('Charge not found');
    }

    const status = this.mapStatus(dto.status);

    if (charge.paymentAttempt.status !== status) {
      const updatedAttempt = await this.prisma.paymentAttempt.update({
        where: { id: charge.paymentAttemptId },
        data: {
          status,
          metadata: dto as unknown as Prisma.JsonValue,
        },
        include: { order: true },
      });

      if (status === PaymentStatus.SUCCEEDED) {
        await this.prisma.order.update({
          where: { id: updatedAttempt.orderId },
          data: { status: OrderStatus.PAID },
        });
      }

      await this.notifications.emit('payment-status', {
        orderId: updatedAttempt.orderId,
        provider: PaymentProvider.CODI,
        status,
      });
    }

    await this.prisma.codiCharge.update({
      where: { id: charge.id },
      data: {
        status: dto.status,
        rawResponse: dto as unknown as Prisma.JsonValue,
      },
    });

    await this.notifications.emit('codi-status', {
      orderId: charge.paymentAttempt.orderId,
      codiId: dto.codiId,
      status: dto.status,
    });

    return { success: true };
  }

  private mapStatus(status: string): PaymentStatus {
    switch (status) {
      case 'paid':
      case 'confirmed':
        return PaymentStatus.SUCCEEDED;
      case 'failed':
      case 'cancelled':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
