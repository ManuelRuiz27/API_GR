import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested, IsUUID, IsEnum } from 'class-validator';
import { LayoutStatus } from '@prisma/client';
import { ElementConfigDto } from './element-config.dto';

export class CreateLayoutDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  venueId!: string;

  @IsString()
  @IsOptional()
  zoneId?: string;

  @IsEnum(LayoutStatus)
  @IsOptional()
  status?: LayoutStatus;

  @ValidateNested({ each: true })
  @Type(() => ElementConfigDto)
  @IsArray()
  elements!: ElementConfigDto[];

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsUUID()
  @IsOptional()
  basedOnLayoutId?: string;
}
