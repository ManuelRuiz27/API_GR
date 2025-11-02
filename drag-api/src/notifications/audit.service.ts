import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, resourceType: string, resourceId: string, metadata: Prisma.JsonValue | null, actorId?: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action,
        resourceType,
        resourceId,
        metadata,
        actorId,
      },
    });
  }

  async query(params: { status?: string; method?: string; from?: Date; to?: Date; resourceType?: string; action?: string; actorId?: string; take?: number; skip?: number }): Promise<{ data: unknown[]; total: number }> {
    const { take = 20, skip = 0, ...filters } = params;
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }
}
