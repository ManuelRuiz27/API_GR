import { ReservationStatus, SeatStatus } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import { HoldReservationDto } from './dto/hold-reservation.dto';
import { ConfirmReservationDto } from './dto/confirm-reservation.dto';

describe('ReservationsService', () => {
  let service: ReservationsService;
  const prisma = {
    $transaction: jest.fn(),
  } as any;
  const notifications = {
    emit: jest.fn().mockResolvedValue(undefined),
  };
  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ReservationsService(prisma, notifications as any, audit as any);
  });

  it('holds seats and emits notifications after committing the transaction', async () => {
    jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue('token-value');

    const dto: HoldReservationDto = {
      eventId: 'event-1',
      tableId: 'table-1',
      seatIds: ['seat-1'],
      durationSeconds: 60,
    };

    const tx = {
      seat: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'seat-1',
            tableId: 'table-1',
            status: SeatStatus.AVAILABLE,
            holdEndsAt: null,
          },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      reservationSeat: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        createMany: jest.fn().mockResolvedValue(undefined),
      },
      holdingToken: {
        create: jest.fn().mockResolvedValue({ id: 'holding-id', eventId: 'event-1', tableId: 'table-1' }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.holdSeats(dto);

    expect(result.holdingToken).toBe('token-value');
    expect(notifications.emit).toHaveBeenCalledWith('seat-status', expect.objectContaining({ seatId: 'seat-1', status: SeatStatus.HELD }));
    expect(audit.log).toHaveBeenCalledWith('seat.hold', 'seat', dto.tableId, expect.objectContaining({ seatIds: dto.seatIds, token: 'token-value' }));
  });

  it('confirms reservation, reserves seats and logs audit entry', async () => {
    const dto: ConfirmReservationDto = {
      token: 'token-value',
      customerName: 'Customer',
      customerEmail: 'customer@example.com',
    };

    const tx = {
      holdingToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 'holding-id', eventId: 'event-1', tableId: 'table-1', expiresAt: new Date(Date.now() + 60_000), seats: [] }),
      },
      seat: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'seat-1', tableId: 'table-1', status: SeatStatus.HELD },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      reservation: {
        create: jest.fn().mockResolvedValue({ id: 'reservation-1', status: ReservationStatus.CONFIRMED }),
      },
      reservationSeat: {
        updateMany: jest.fn().mockResolvedValue(undefined),
      },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const response = await service.confirm({ ...dto, totalAmount: 120, currency: 'MXN', items: [{ description: 'Seat', quantity: 1, unitPrice: 120 }] });

    expect(response.reservation.id).toBe('reservation-1');
    expect(response.order?.id).toBe('order-1');
    expect(notifications.emit).toHaveBeenCalledWith('seat-status', expect.objectContaining({ seatId: 'seat-1', status: SeatStatus.RESERVED }));
    expect(audit.log).toHaveBeenCalledWith('reservation.confirmed', 'reservation', 'reservation-1', expect.objectContaining({ orderId: 'order-1' }));
  });
});
