import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { LayoutStatus } from '@prisma/client';
import { ElementConfigDto } from './element-config.dto';

export class UpdateLayoutDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  venueId?: string;

  @IsString()
  @IsOptional()
  zoneId?: string;

  @IsEnum(LayoutStatus)
  @IsOptional()
  status?: LayoutStatus;

  @ValidateNested({ each: true })
  @Type(() => ElementConfigDto)
  @IsArray()
  @IsOptional()
  elements?: ElementConfigDto[];

  @IsArray()
  @IsOptional()
  tags?: string[];
}
