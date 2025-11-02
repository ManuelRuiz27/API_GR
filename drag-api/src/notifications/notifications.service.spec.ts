import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: jest.Mocked<Pick<PrismaService, 'notificationQueue'>>;

  beforeEach(() => {
    prisma = {
      notificationQueue: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<PrismaService, 'notificationQueue'>>;

    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('creates notification records and delivers payloads', async () => {
    const handler = jest.fn();
    const dispose = service.on('payment-status', handler);

    prisma.notificationQueue.create.mockResolvedValue({ id: 'queue-1' } as any);
    prisma.notificationQueue.update.mockResolvedValue({} as any);

    await service.emit('payment-status', { status: 'pending' });

    expect(prisma.notificationQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: 'payment-status' }),
      }),
    );
    expect(prisma.notificationQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'queue-1' },
        data: expect.objectContaining({ status: 'delivered' }),
      }),
    );
    expect(handler).toHaveBeenCalledWith({ status: 'pending' });

    dispose();
  });

  it('marks failed deliveries and rethrows the error', async () => {
    prisma.notificationQueue.create.mockResolvedValue({ id: 'queue-2' } as any);
    prisma.notificationQueue.update.mockResolvedValue({} as any);

    const failingListener = () => {
      throw new Error('listener failed');
    };
    service.on('seat-status', failingListener);

    await expect(service.emit('seat-status', { seatId: 'seat-1' })).rejects.toThrow('listener failed');

    expect(prisma.notificationQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'queue-2' },
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('retries pending notifications', async () => {
    const listener = jest.fn();
    service.on('payment-status', listener);

    prisma.notificationQueue.findMany.mockResolvedValue([
      { id: 'queue-3', event: 'payment-status', payload: { status: 'pending' } },
    ] as any);
    prisma.notificationQueue.update.mockResolvedValue({} as any);

    const processed = await service.retryPending();

    expect(processed).toBe(1);
    expect(listener).toHaveBeenCalledWith({ status: 'pending' });
  });
});
