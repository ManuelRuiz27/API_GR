import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSpeiReferenceDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsString()
  bankCode?: string;
}
