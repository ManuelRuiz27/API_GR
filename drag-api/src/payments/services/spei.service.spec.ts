import { BankReferenceStatus, PaymentStatus } from '@prisma/client';
import { SpeiService } from './spei.service';
import { ConfirmSpeiPaymentDto } from '../dto/confirm-spei-payment.dto';

describe('SpeiService', () => {
  let service: SpeiService;
  const notifications = {
    emit: jest.fn().mockResolvedValue(undefined),
  };
  const prisma: any = {
    order: { update: jest.fn().mockResolvedValue(undefined) },
    paymentAttempt: {
      update: jest.fn(),
    },
    speiReference: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    bankReference: {
      updateMany: jest.fn().mockResolvedValue(undefined),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SpeiService(prisma, notifications as any);
  });

  it('confirms a SPEI reference and emits notifications', async () => {
    const dto: ConfirmSpeiPaymentDto = {
      reference: 'REF123',
      amount: 120,
      receiptUrl: 'https://example.com/receipt',
    };

    prisma.speiReference.findUnique.mockResolvedValue({ id: 'spei-id', paymentAttemptId: 'attempt-1' });
    prisma.paymentAttempt.update.mockResolvedValue({ id: 'attempt-1', orderId: 'order-1', order: { id: 'order-1' } });

    await service.confirm(dto);

    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
      include: { order: true },
    });
    expect(prisma.speiReference.update).toHaveBeenCalledWith({
      where: { id: 'spei-id' },
      data: expect.objectContaining({ status: 'confirmed', receiptUrl: dto.receiptUrl }),
    });
    expect(prisma.bankReference.updateMany).toHaveBeenCalledWith({
      where: { reference: dto.reference },
      data: expect.objectContaining({ status: BankReferenceStatus.RECONCILED, receiptUrl: dto.receiptUrl }),
    });
    expect(notifications.emit).toHaveBeenCalledWith('payment-status', expect.objectContaining({ orderId: 'order-1', status: PaymentStatus.SUCCEEDED }));
    expect(notifications.emit).toHaveBeenCalledWith('reference-updated', expect.objectContaining({ status: BankReferenceStatus.RECONCILED }));
  });
});
