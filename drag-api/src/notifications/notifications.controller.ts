import { Controller, Get, Query, Sse, UseGuards, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('api/events')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Get('stream')
  @Sse()
  stream(@Query('events') eventsParam?: string): Observable<MessageEvent> {
    const events = eventsParam?.split(',').map((event) => event.trim()).filter(Boolean) ?? [
      'payment-status',
      'reference-updated',
      'codi-status',
      'spei-confirmed',
      'seat-status',
    ];

    const subject = new Subject<MessageEvent>();
    const listeners = events.map((event) =>
      this.notifications.on(event, (payload) => {
        subject.next({
          type: event,
          data: {
            event,
            payload,
            deliveredAt: new Date().toISOString(),
          },
        });
      }),
    );

    return subject.pipe(
      finalize(() => {
        listeners.forEach((dispose) => dispose());
      }),
    );
  }

  @Get('/audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF)
  async audit(@Query('resourceType') resourceType?: string, @Query('action') action?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;
    const { data, total } = await this.audit.query({
      resourceType,
      action,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      skip,
      take,
    });

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        pageSize: take,
      },
    };
  }
}
