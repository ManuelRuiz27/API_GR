import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BankReferenceStatus } from '@prisma/client';

export class ReconcileReferenceDto {
  @IsEnum(BankReferenceStatus)
  status!: BankReferenceStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
