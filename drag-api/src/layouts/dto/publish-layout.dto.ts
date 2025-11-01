import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class PublishLayoutDto {
  @IsUUID()
  eventId!: string;

  @IsDateString()
  @IsOptional()
  publishAt?: string;
}
