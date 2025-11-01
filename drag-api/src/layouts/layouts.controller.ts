import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateLayoutDto } from './dto/create-layout.dto';
import { PublishLayoutDto } from './dto/publish-layout.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { LayoutResponse, LayoutsService } from './layouts.service';

@Controller('layouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LayoutsController {
  constructor(private readonly layoutsService: LayoutsService) {}

  @Post()
  @Roles(Role.STAFF, Role.HOST)
  create(@Body() dto: CreateLayoutDto, @CurrentUser() user?: JwtPayload): Promise<LayoutResponse> {
    return this.layoutsService.create(dto, user?.sub);
  }

  @Get()
  @Roles(Role.STAFF, Role.HOST)
  findAll(): Promise<LayoutResponse[]> {
    return this.layoutsService.findAll();
  }

  @Get(':id')
  @Roles(Role.STAFF, Role.HOST)
  findOne(@Param('id') id: string): Promise<LayoutResponse> {
    return this.layoutsService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.STAFF)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLayoutDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<LayoutResponse> {
    return this.layoutsService.update(id, dto, user?.sub);
  }

  @Delete(':id')
  @Roles(Role.STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.layoutsService.remove(id);
  }

  @Post(':id/publish')
  @Roles(Role.STAFF, Role.HOST)
  @HttpCode(HttpStatus.ACCEPTED)
  publish(
    @Param('id') id: string,
    @Body() dto: PublishLayoutDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<LayoutResponse> {
    return this.layoutsService.publish(id, dto, user?.sub);
  }
}
