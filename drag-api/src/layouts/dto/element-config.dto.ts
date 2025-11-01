import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, Min } from 'class-validator';
import { ElementConfig } from '../types/element-config';

class ElementPositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

class ElementSizeDto {
  @IsNumber()
  width!: number;

  @IsNumber()
  height!: number;
}

export class ElementConfigDto implements ElementConfig {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  iconId?: string;

  @ValidateNested()
  @Type(() => ElementPositionDto)
  position!: ElementPositionDto;

  @ValidateNested()
  @Type(() => ElementSizeDto)
  size!: ElementSizeDto;

  @IsNumber()
  @IsOptional()
  rotation?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  capacity?: number;

  metadata?: Record<string, unknown>;
}
