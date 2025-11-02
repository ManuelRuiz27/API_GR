import { IsUUID } from 'class-validator';

export class CreateCodiChargeDto {
  @IsUUID()
  orderId!: string;
}
