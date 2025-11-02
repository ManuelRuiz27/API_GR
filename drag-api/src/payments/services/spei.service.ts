import { Injectable, NotFoundException } from '@nestjs/common';
import { BankReferenceMethod, BankReferenceStatus, OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateSpeiReferenceDto } from '../dto/create-spei-reference.dto';
import { ConfirmSpeiPaymentDto } from '../dto/confirm-spei-payment.dto';

@Injectable()
export class SpeiService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async createReference(dto: CreateSpeiReferenceDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const reference = randomUUID().replace(/-/g, '').slice(0, 18).toUpperCase();

    const paymentAttempt = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.SPEI,
          status: PaymentStatus.PENDING,
          amount: order.totalAmount,
        },
      });

      await tx.speiReference.create({
        data: {
          paymentAttemptId: attempt.id,
          reference,
          status: 'pending',
          rawResponse: { bankCode: dto.bankCode ?? null } as Prisma.JsonValue,
        },
      });

      await tx.bankReference.create({
        data: {
          orderId: order.id,
          method: BankReferenceMethod.SPEI,
          reference,
          status: BankReferenceStatus.PENDING,
          amount: order.totalAmount,
        },
      });

      return attempt;
    });

    await this.notifications.emit('reference-updated', {
      orderId: dto.orderId,
      method: 'SPEI',
      reference,
    });

    await this.notifications.emit('payment-status', {
      orderId: dto.orderId,
      provider: PaymentProvider.SPEI,
      status: PaymentStatus.PENDING,
    });

    return { reference, paymentAttemptId: paymentAttempt.id };
  }

  async confirm(dto: ConfirmSpeiPaymentDto) {
    const spei = await this.prisma.speiReference.findUnique({
      where: { reference: dto.reference },
      include: { paymentAttempt: true },
    });

    if (!spei) {
      throw new NotFoundException('Reference not found');
    }

    const status = PaymentStatus.SUCCEEDED;

    const attempt = await this.prisma.paymentAttempt.update({
      where: { id: spei.paymentAttemptId },
      data: {
        status,
        metadata: dto as unknown as Prisma.JsonValue,
      },
      include: { order: true },
    });

    await this.prisma.speiReference.update({
      where: { id: spei.id },
      data: {
        status: 'confirmed',
        receiptUrl: dto.receiptUrl ?? null,
      },
    });

    await this.prisma.bankReference.updateMany({
      where: { reference: dto.reference },
      data: {
        status: BankReferenceStatus.RECONCILED,
        receiptUrl: dto.receiptUrl ?? null,
      },
    });

    await this.prisma.order.update({
      where: { id: attempt.orderId },
      data: { status: OrderStatus.PAID },
    });

    await this.notifications.emit('spei-confirmed', {
      orderId: attempt.orderId,
      reference: dto.reference,
      amount: dto.amount,
    });

    await this.notifications.emit('payment-status', {
      orderId: attempt.orderId,
      provider: PaymentProvider.SPEI,
      status,
    });

    await this.notifications.emit('reference-updated', {
      orderId: attempt.orderId,
      method: 'SPEI',
      reference: dto.reference,
      status: BankReferenceStatus.RECONCILED,
    });

    return { success: true };
  }

  async getReceipt(reference: string) {
    const spei = await this.prisma.speiReference.findUnique({
      where: { reference },
    });

    if (!spei) {
      throw new NotFoundException('Reference not found');
    }

    return spei;
  }
}
