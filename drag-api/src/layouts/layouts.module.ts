import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IconsController } from './icons.controller';
import { IconsService } from './icons.service';
import { LayoutsController } from './layouts.controller';
import { LayoutsService } from './layouts.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LayoutsController, IconsController],
  providers: [LayoutsService, IconsService],
  exports: [LayoutsService],
})
export class LayoutsModule {}
