import { LayoutStatus } from '@prisma/client';
import { LayoutsService } from './layouts.service';
import { PrismaService } from '../prisma/prisma.service';

const baseLayout = {
  id: 'layout-1',
  name: 'Main Hall',
  description: 'Evening layout',
  venueId: '11111111-1111-1111-1111-111111111111',
  zoneId: null,
  version: 1,
  json: {
    elements: [
      { id: 'table-1', type: 'table', position: { x: 1, y: 2 }, size: { width: 3, height: 2 } },
    ],
    tags: ['vip'],
  },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  publishedAt: null,
  status: LayoutStatus.DRAFT,
  createdBy: 'user-1',
};

describe('LayoutsService integration', () => {
  let service: LayoutsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      layout: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      layoutVersion: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    service = new LayoutsService(prisma);
  });

  it('persists a new layout and snapshot version', async () => {
    const createDto = {
      name: 'Main Hall',
      description: 'Evening layout',
      venueId: '11111111-1111-1111-1111-111111111111',
      elements: baseLayout.json.elements,
      tags: ['vip'],
    };

    const createdLayout = { ...baseLayout };

    const tx = {
      layout: {
        create: jest.fn().mockResolvedValue(createdLayout),
      },
      layoutVersion: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx));

    const result = await service.create(createDto as any, 'user-1');

    expect(result.id).toEqual(createdLayout.id);
    expect(result.elements).toHaveLength(1);
    expect(tx.layout.create).toHaveBeenCalled();
    expect(tx.layoutVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ layoutId: createdLayout.id, version: createdLayout.version }),
      }),
    );
  });

  it('publishes a layout and records an audit log', async () => {
    const publishDate = new Date('2024-02-01T00:00:00Z');
    const updatedLayout = { ...baseLayout, status: LayoutStatus.PUBLISHED, publishedAt: publishDate };

    prisma.layout.update = jest.fn().mockResolvedValue(updatedLayout);

    const response = await service.publish(baseLayout.id, { eventId: 'event-1', publishAt: publishDate.toISOString() }, 'user-1');

    expect(response.status).toBe(LayoutStatus.PUBLISHED);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resourceId: baseLayout.id,
          actorId: 'user-1',
        }),
      }),
    );
  });
});
