import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationStatus, SeatStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../notifications/audit.service';
import { HoldReservationDto } from './dto/hold-reservation.dto';
import { ConfirmReservationDto } from './dto/confirm-reservation.dto';
import { WaitlistEntryDto } from './dto/waitlist-entry.dto';

const DEFAULT_HOLD_SECONDS = 300;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async holdSeats(dto: HoldReservationDto) {
    const expiresAt = new Date(Date.now() + 1000 * (dto.durationSeconds ?? DEFAULT_HOLD_SECONDS));

    const result = await this.prisma.$transaction(async (tx) => {
      const seats = await tx.seat.findMany({
        where: {
          id: { in: dto.seatIds },
          tableId: dto.tableId,
        },
        include: {
          table: true,
        },
      });

      if (seats.length !== dto.seatIds.length) {
        throw new NotFoundException('One or more seats were not found');
      }

      const now = new Date();
      for (const seat of seats) {
        if (seat.status === SeatStatus.RESERVED || seat.status === SeatStatus.BLOCKED) {
          throw new ConflictException(`Seat ${seat.id} is not available`);
        }
        if (seat.status === SeatStatus.HELD && seat.holdEndsAt && seat.holdEndsAt > now) {
          throw new ConflictException(`Seat ${seat.id} is already held`);
        }
      }

      await tx.reservationSeat.deleteMany({
        where: { seatId: { in: dto.seatIds } },
      });

      const tokenValue = randomUUID();
      const token = await tx.holdingToken.create({
        data: {
          token: tokenValue,
          eventId: dto.eventId,
          tableId: dto.tableId,
          expiresAt,
        },
      });

      await Promise.all(
        seats.map((seat) =>
          tx.seat.update({
            where: { id: seat.id },
            data: {
              status: SeatStatus.HELD,
              holdEndsAt: expiresAt,
            },
          }),
        ),
      );

      await tx.reservationSeat.createMany({
        data: seats.map((seat) => ({
          seatId: seat.id,
          holdingTokenId: token.id,
          status: SeatStatus.HELD,
        })),
      });

      return {
        tokenValue,
        expiresAt,
        seatEvents: seats.map((seat) => ({
          seatId: seat.id,
          tableId: seat.tableId,
          status: SeatStatus.HELD,
          expiresAt: expiresAt.toISOString(),
        })),
        holdingToken: tokenValue,
        expiresAt,
      };
    });

    for (const event of result.seatEvents) {
      await this.notifications.emit('seat-status', event);
    }

    await this.audit.log('seat.hold', 'seat', dto.tableId, {
      seatIds: dto.seatIds,
      token: result.tokenValue,
      expiresAt: result.expiresAt.toISOString(),
    });

    return {
      holdingToken: result.holdingToken,
      expiresAt: result.expiresAt,
    };
  }

  async confirm(dto: ConfirmReservationDto) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const holding = await tx.holdingToken.findUnique({
        where: { token: dto.token },
        include: {
          seats: true,
        },
      });

      if (!holding) {
        throw new NotFoundException('Holding token not found');
      }

      if (holding.expiresAt < now) {
        throw new ConflictException('Holding token expired');
      }

      const seatIds = holding.seats.map((seat) => seat.seatId);
      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds } },
      });

      for (const seat of seats) {
        if (seat.status !== SeatStatus.HELD) {
          throw new ConflictException(`Seat ${seat.id} is no longer held`);
        }
      }

      const reservation = await tx.reservation.create({
        data: {
          eventId: holding.eventId,
          tableId: holding.tableId!,
          holdingTokenId: holding.id,
          status: ReservationStatus.CONFIRMED,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
        },
      });

      await tx.reservationSeat.updateMany({
        where: {
          holdingTokenId: holding.id,
        },
        data: {
          reservationId: reservation.id,
          status: SeatStatus.RESERVED,
        },
      });

      await Promise.all(
        seatIds.map((seatId) =>
          tx.seat.update({
            where: { id: seatId },
            data: {
              status: SeatStatus.RESERVED,
              holdEndsAt: null,
            },
          }),
        ),
      );

      let order = null;
      if (dto.totalAmount && dto.totalAmount > 0) {
        order = await tx.order.create({
          data: {
            reservationId: reservation.id,
            customerName: dto.customerName,
            customerEmail: dto.customerEmail,
            customerPhone: dto.customerPhone,
            totalAmount: dto.totalAmount,
            currency: dto.currency ?? 'MXN',
            items: dto.items
              ? {
                  createMany: {
                    data: dto.items.map((item) => ({
                      description: item.description,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                    })),
                  },
                }
              : undefined,
          },
        });
      }

      return {
        reservation,
        order,
        seatEvents: seats.map((seat) => ({
          seatId: seat.id,
          tableId: seat.tableId,
          status: SeatStatus.RESERVED,
        })),
        seatIds,
      };
    });

    for (const event of result.seatEvents) {
      await this.notifications.emit('seat-status', event);
    }

    await this.audit.log('reservation.confirmed', 'reservation', result.reservation.id, {
      seats: result.seatIds,
      orderId: result.order?.id ?? null,
    });

    return {
      reservation: result.reservation,
      order: result.order,
    };
  }

  async cancel(reservationId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { seats: true },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      const seatIds = reservation.seats.map((seat) => seat.seatId);

      await tx.reservationSeat.deleteMany({
        where: { reservationId },
      });

      await Promise.all(
        seatIds.map((seatId) =>
          tx.seat.update({
            where: { id: seatId },
            data: {
              status: SeatStatus.AVAILABLE,
              holdEndsAt: null,
            },
          }),
        ),
      );

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      return {
        reservation,
        seatIds,
      };
    });

    for (const seatId of result.seatIds) {
      await this.notifications.emit('seat-status', {
        seatId,
        status: SeatStatus.AVAILABLE,
      });
    }

    await this.audit.log('reservation.cancelled', 'reservation', result.reservation.id, {
      seats: result.seatIds,
    });

    return { success: true };
  }

  async joinWaitlist(dto: WaitlistEntryDto) {
    const entry = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.waitlistEntry.findFirst({
        where: {
          eventId: dto.eventId,
          tableId: dto.tableId,
          userId: dto.userId,
        },
      });

      if (existing) {
        throw new ConflictException('Already on waitlist');
      }

      const entry = await tx.waitlistEntry.create({
        data: {
          eventId: dto.eventId,
          tableId: dto.tableId,
          userId: dto.userId,
          scope: dto.scope,
        },
      });

      if (dto.priority !== undefined || dto.notes) {
        await tx.waitlistPriority.create({
          data: {
            entryId: entry.id,
            priority: dto.priority ?? 0,
            notes: dto.notes,
          },
        });
      }

      return entry;
    });

    await this.audit.log('waitlist.join', 'waitlist', entry.id, {
      eventId: dto.eventId,
      tableId: dto.tableId,
    }, dto.userId);

    return entry;
  }

  async leaveWaitlist(tableId: string, userId: string) {
    if (!userId) {
      throw new ForbiddenException('userId is required to leave waitlist');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.waitlistEntry.findFirst({
        where: { tableId, userId },
      });

      if (!entry) {
        throw new NotFoundException('Waitlist entry not found');
      }

      await tx.waitlistPriority.deleteMany({ where: { entryId: entry.id } });
      await tx.waitlistEntry.delete({ where: { id: entry.id } });

      return entry;
    });

    await this.audit.log('waitlist.leave', 'waitlist', result.id, { tableId }, userId);

    return { success: true };
  }
}
