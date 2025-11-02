import { BankReferenceMethod, BankReferenceStatus } from '@prisma/client';
import { ReferencesService } from './references.service';
import { ReferenceFiltersDto } from './dto/reference-filters.dto';
import { ReconcileReferenceDto } from './dto/reconcile-reference.dto';

describe('ReferencesService', () => {
  const notifications = {
    emit: jest.fn().mockResolvedValue(undefined),
  };
  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const prisma: any = {
    bankReference: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reconciliationNote: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: ReferencesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReferencesService(prisma, notifications as any, audit as any);
  });

  it('lists references applying filters', async () => {
    const filters: ReferenceFiltersDto = {
      status: BankReferenceStatus.PENDING,
      method: BankReferenceMethod.SPEI,
      from: '2024-01-01',
      to: '2024-01-31',
      page: 2,
      pageSize: 10,
    };

    prisma.bankReference.findMany.mockResolvedValue([{ id: 'ref-1' }]);
    prisma.bankReference.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));

    const result = await service.list(filters);

    expect(prisma.bankReference.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: BankReferenceStatus.PENDING, method: BankReferenceMethod.SPEI }),
      skip: 10,
      take: 10,
    }));
    expect(result.pagination.total).toBe(1);
  });

  it('reconciles a reference and records audit logs', async () => {
    prisma.bankReference.findUnique.mockResolvedValue({ id: 'ref-1', orderId: 'order-1', receiptUrl: null });

    const tx = {
      bankReference: {
        update: jest.fn().mockResolvedValue({ id: 'ref-1', orderId: 'order-1' }),
      },
      reconciliationNote: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const dto: ReconcileReferenceDto = {
      status: BankReferenceStatus.RECONCILED,
      note: 'Matched bank transfer',
      receiptUrl: 'https://example.com/receipt',
    };

    await service.reconcile('ref-1', dto, 'user-1');

    expect(tx.bankReference.update).toHaveBeenCalledWith({
      where: { id: 'ref-1' },
      data: expect.objectContaining({ status: dto.status, receiptUrl: dto.receiptUrl }),
      include: { notes: true, order: true },
    });
    expect(tx.reconciliationNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ referenceId: 'ref-1', userId: 'user-1', note: dto.note }),
    });
    expect(audit.log).toHaveBeenCalledWith('bankReference.reconciled', 'bankReference', 'ref-1', expect.any(Object), 'user-1');
    expect(notifications.emit).toHaveBeenCalledWith('reference-updated', expect.objectContaining({ referenceId: 'ref-1', status: dto.status }));
  });
});
