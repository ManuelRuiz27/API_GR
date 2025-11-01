import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaAsset, Role } from '@prisma/client';
import type { Express } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateIconDto } from './dto/create-icon.dto';
import { IconsService } from './icons.service';

@Controller('icons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IconsController {
  constructor(private readonly iconsService: IconsService) {}

  @Get()
  @Roles(Role.STAFF, Role.HOST)
  findAll(): Promise<MediaAsset[]> {
    return this.iconsService.findAll();
  }

  @Post()
  @Roles(Role.STAFF)
  @UseInterceptors(FileInterceptor('file'))
  create(@Body() dto: CreateIconDto, @UploadedFile() file: Express.Multer.File): Promise<MediaAsset> {
    return this.iconsService.create(dto, file);
  }
}
