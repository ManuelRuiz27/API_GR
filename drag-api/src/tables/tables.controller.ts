import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetTableMapDto } from './dto/get-table-map.dto';
import { TablesService } from './tables.service';
import { TableMapResponse } from './types/table-map-response';

@Controller('table-map')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @Roles(Role.STAFF, Role.HOST, Role.CLIENT)
  getTableMap(@Query() query: GetTableMapDto): Promise<TableMapResponse> {
    return this.tablesService.getTableMap(query.eventId, query.zoneId);
  }
}
