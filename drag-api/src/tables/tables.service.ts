import { Injectable, NotFoundException } from '@nestjs/common';
import { Layout, SeatStatus, WaitlistScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ElementConfig } from '../layouts/types/element-config';
import { TableMapResponse } from './types/table-map-response';

interface LayoutJsonPayload {
  elements?: ElementConfig[];
  tags?: string[];
}

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTableMap(eventId: string, zoneId?: string): Promise<TableMapResponse> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { layout: true },
    });

    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    const layoutPayload = this.extractLayoutPayload(event.layout);

    const tables = await this.prisma.table.findMany({
      where: {
        eventId,
        ...(zoneId ? { zoneId } : {}),
      },
      select: {
        id: true,
        layoutElementId: true,
        capacity: true,
      },
    });

    const tableIds = tables.map((table) => table.id);
    const seatGroups = tableIds.length
      ? await this.prisma.seat.groupBy({
          by: ['tableId', 'status'],
          _count: {
            _all: true,
          },
          where: {
            tableId: {
              in: tableIds,
            },
          },
        })
      : [];

    const seatAggregation = new Map<string, Partial<Record<SeatStatus, number>>>();
    for (const group of seatGroups) {
      const tableCounts = seatAggregation.get(group.tableId) ?? {};
      tableCounts[group.status] = group._count._all;
      seatAggregation.set(group.tableId, tableCounts);
    }

    const availability = tables.map((table) => {
      const counts = seatAggregation.get(table.id) ?? {};
      const status = this.resolveAvailabilityStatus(counts);
      return {
        elementId: table.layoutElementId,
        status,
        holdExpiresAt: null,
        reservationId: null,
      };
    });

    const availableSeats = Array.from(seatAggregation.values()).reduce(
      (total, counts) => total + (counts[SeatStatus.AVAILABLE] ?? 0),
      0,
    );

    const availableTables = availability.filter((entry) => entry.status === 'available').length;

    const waitlistGroups = await this.prisma.waitlistEntry.groupBy({
      by: ['scope'],
      _count: {
        _all: true,
      },
      where: { eventId },
    });

    const venueWaitlist = waitlistGroups.find((group) => group.scope === WaitlistScope.VENUE)?._count._all ?? 0;
    const userWaitlistCount = waitlistGroups.find((group) => group.scope === WaitlistScope.USER)?._count._all ?? 0;

    const elementIds = new Set(tables.map((table) => table.layoutElementId));
    const elements = (layoutPayload.elements ?? []).filter((element) => elementIds.has(element.id));

    return {
      layoutId: event.layoutId,
      eventId: event.id,
      version: event.layout.version,
      elements,
      availability,
      pricing: [],
      metadata: {
        totalTables: tables.length,
        availableTables,
        availableSeats,
        venueWaitlist,
        userWaitlistCount,
      },
    };
  }

  private resolveAvailabilityStatus(counts: Partial<Record<SeatStatus, number>>):
    | 'available'
    | 'held'
    | 'reserved'
    | 'blocked' {
    if ((counts[SeatStatus.RESERVED] ?? 0) > 0) {
      return 'reserved';
    }

    if ((counts[SeatStatus.HELD] ?? 0) > 0) {
      return 'held';
    }

    if ((counts[SeatStatus.BLOCKED] ?? 0) > 0) {
      return 'blocked';
    }

    return 'available';
  }

  private extractLayoutPayload(layout: Layout): LayoutJsonPayload {
    const json = layout.json as LayoutJsonPayload | null;
    if (json && Array.isArray(json.elements)) {
      return json;
    }

    return { elements: [], tags: [] };
  }
}
