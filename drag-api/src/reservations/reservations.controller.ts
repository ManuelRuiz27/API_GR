import { Body, Controller, Delete, Param, Post, Query } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { HoldReservationDto } from './dto/hold-reservation.dto';
import { ConfirmReservationDto } from './dto/confirm-reservation.dto';
import { WaitlistEntryDto } from './dto/waitlist-entry.dto';

@Controller('api')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post('reservations/hold')
  async hold(@Body() dto: HoldReservationDto) {
    return this.reservations.holdSeats(dto);
  }

  @Post('reservations')
  async confirm(@Body() dto: ConfirmReservationDto) {
    return this.reservations.confirm(dto);
  }

  @Delete('reservations/:id')
  async cancel(@Param('id') id: string) {
    return this.reservations.cancel(id);
  }

  @Post('waitlist')
  async joinWaitlist(@Body() dto: WaitlistEntryDto) {
    return this.reservations.joinWaitlist(dto);
  }

  @Delete('waitlist/:tableId')
  async leave(@Param('tableId') tableId: string, @Query('userId') userId: string) {
    return this.reservations.leaveWaitlist(tableId, userId);
  }
}
