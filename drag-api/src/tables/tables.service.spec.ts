import { TablesService } from './tables.service';
import { PrismaService } from '../prisma/prisma.service';
import { SeatStatus, WaitlistScope } from '@prisma/client';

describe('TablesService', () => {
  let prisma: any;
  let service: TablesService;

  beforeEach(() => {
    prisma = {
      event: {
        findUnique: jest.fn(),
      },
      table: {
        findMany: jest.fn(),
      },
      seat: {
        groupBy: jest.fn(),
      },
      waitlistEntry: {
        groupBy: jest.fn(),
      },
    } as unknown as PrismaService;

    service = new TablesService(prisma);
  });

  it('computes availability and metrics from seat data', async () => {
    const layoutPayload = {
      elements: [
        { id: 'table-1', type: 'table', position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
      ],
      tags: [],
    };

    prisma.event.findUnique.mockResolvedValue({
      id: 'event-1',
      layoutId: 'layout-1',
      layout: { id: 'layout-1', version: 2, json: layoutPayload },
    });

    prisma.table.findMany.mockResolvedValue([
      { id: 't1', layoutElementId: 'table-1', capacity: 4 },
    ]);

    prisma.seat.groupBy.mockResolvedValue([
      { tableId: 't1', status: SeatStatus.AVAILABLE, _count: { _all: 3 } },
      { tableId: 't1', status: SeatStatus.RESERVED, _count: { _all: 1 } },
    ]);

    prisma.waitlistEntry.groupBy.mockResolvedValue([
      { scope: WaitlistScope.VENUE, _count: { _all: 2 } },
      { scope: WaitlistScope.USER, _count: { _all: 5 } },
    ]);

    const result = await service.getTableMap('event-1');

    expect(result.layoutId).toBe('layout-1');
    expect(result.availability).toHaveLength(1);
    expect(result.metadata.totalTables).toBe(1);
    expect(result.metadata.availableSeats).toBe(3);
    expect(result.metadata.venueWaitlist).toBe(2);
    expect(result.metadata.userWaitlistCount).toBe(5);
  });
});
