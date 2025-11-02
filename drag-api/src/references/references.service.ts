import { Injectable, NotFoundException } from '@nestjs/common';
import { BankReferenceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../notifications/audit.service';
import { ReferenceFiltersDto } from './dto/reference-filters.dto';
import { ReconcileReferenceDto } from './dto/reconcile-reference.dto';

@Injectable()
export class ReferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: ReferenceFiltersDto) {
    const where: Prisma.BankReferenceWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.method) {
      where.method = filters.method;
    }

    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.bankReference.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { order: true, notes: true },
        skip,
        take: pageSize,
      }),
      this.prisma.bankReference.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
      },
    };
  }

  async reconcile(id: string, dto: ReconcileReferenceDto, actorId?: string) {
    const reference = await this.prisma.bankReference.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!reference) {
      throw new NotFoundException('Reference not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.bankReference.update({
        where: { id },
        data: {
          status: dto.status,
          receiptUrl: dto.receiptUrl ?? reference.receiptUrl,
        },
        include: { notes: true, order: true },
      });

      if (dto.note || dto.receiptUrl) {
        await tx.reconciliationNote.create({
          data: {
            referenceId: id,
            userId: actorId,
            note: dto.note,
            receiptUrl: dto.receiptUrl,
          },
        });
      }

      return result;
    });

    await this.audit.log('bankReference.reconciled', 'bankReference', id, {
      status: dto.status,
      note: dto.note,
      receiptUrl: dto.receiptUrl,
    }, actorId);

    await this.notifications.emit('reference-updated', {
      referenceId: id,
      status: dto.status,
      orderId: updated.orderId,
    });

    return updated;
  }
}
