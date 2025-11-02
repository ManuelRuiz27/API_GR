import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let prisma: jest.Mocked<Pick<PrismaService, 'auditLog'>>;
  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<PrismaService, 'auditLog'>>;

    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('persists audit entries with metadata', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'log-1' } as any);

    await service.log('resource.created', 'resource', 'res-1', { foo: 'bar' }, 'actor-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'resource.created',
          resourceId: 'res-1',
          actorId: 'actor-1',
        }),
      }),
    );
  });

  it('queries audit entries with pagination', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }] as any);
    prisma.auditLog.count.mockResolvedValue(1 as any);

    const result = await service.query({ resourceType: 'reservation', take: 10, skip: 0 });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resourceType: 'reservation' }),
        take: 10,
        skip: 0,
      }),
    );
    expect(result).toEqual({ data: [{ id: 'log-1' }], total: 1 });
  });
});
