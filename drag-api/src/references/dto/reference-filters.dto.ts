import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BankReferenceMethod, BankReferenceStatus } from '@prisma/client';

export class ReferenceFiltersDto {
  @IsOptional()
  @IsEnum(BankReferenceStatus)
  status?: BankReferenceStatus;

  @IsOptional()
  @IsEnum(BankReferenceMethod)
  method?: BankReferenceMethod;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
