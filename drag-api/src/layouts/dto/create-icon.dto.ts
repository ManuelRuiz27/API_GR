import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class CreateIconDto {
  @IsString()
  name!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.length > 0) {
      return [value];
    }
    return [];
  })
  @IsString({ each: true })
  tags?: string[];
}
