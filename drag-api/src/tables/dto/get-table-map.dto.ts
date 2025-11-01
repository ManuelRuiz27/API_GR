import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GetTableMapDto {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsOptional()
  zoneId?: string;
}
