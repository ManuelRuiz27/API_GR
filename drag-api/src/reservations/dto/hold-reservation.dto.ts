import { IsArray, IsOptional, IsString, IsUUID, ArrayNotEmpty, IsInt, Min } from 'class-validator';

export class HoldReservationDto {
  @IsUUID()
  eventId!: string;

  @IsUUID()
  tableId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  seatIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(30)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}
