import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationPayload {
  event: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly emitter = new EventEmitter2();

  constructor(private readonly prisma: PrismaService) {}

  on(event: string, listener: (payload: Record<string, unknown>) => void): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  async emit(event: string, payload: Record<string, unknown>): Promise<void> {
    const record = await this.prisma.notificationQueue.create({
      data: {
        event,
        payload: payload as Prisma.JsonObject,
      },
    });

    try {
      this.emitter.emit(event, payload);
      await this.prisma.notificationQueue.update({
        where: { id: record.id },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to deliver notification ${record.id}`, error instanceof Error ? error.stack : undefined);
      await this.prisma.notificationQueue.update({
        where: { id: record.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async retryPending(limit = 10): Promise<number> {
    const pending = await this.prisma.notificationQueue.findMany({
      where: { status: { in: ['pending', 'failed'] } },
      take: limit,
    });

    for (const record of pending) {
      try {
        this.emitter.emit(record.event, record.payload as Record<string, unknown>);
        await this.prisma.notificationQueue.update({
          where: { id: record.id },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
      } catch (error) {
        this.logger.error(`Retry failed for notification ${record.id}`);
        await this.prisma.notificationQueue.update({
          where: { id: record.id },
          data: {
            status: 'failed',
            attempts: { increment: 1 },
            lastError: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    return pending.length;
  }
}
