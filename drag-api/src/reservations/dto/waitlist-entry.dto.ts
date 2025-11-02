import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { WaitlistScope } from '@prisma/client';

export class WaitlistEntryDto {
  @IsUUID()
  eventId!: string;

  @IsUUID()
  tableId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsEnum(WaitlistScope)
  scope!: WaitlistScope;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  priority?: number;
}
