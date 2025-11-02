import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';
import { ReferencesService } from './references.service';
import { ReferenceFiltersDto } from './dto/reference-filters.dto';
import { ReconcileReferenceDto } from './dto/reconcile-reference.dto';

@Controller('api/references')
export class ReferencesController {
  constructor(private readonly references: ReferencesService) {}

  @Get()
  async list(@Query() filters: ReferenceFiltersDto) {
    return this.references.list(filters);
  }

  @Post(':id/reconcile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF)
  async reconcile(@Param('id') id: string, @Body() dto: ReconcileReferenceDto, @Req() req: { user?: { id?: string } }) {
    return this.references.reconcile(id, dto, req.user?.id);
  }
}
