import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from './audit.service';

@Module({
  imports: [PrismaModule],
  providers: [NotificationsService, AuditService],
  controllers: [NotificationsController],
  exports: [NotificationsService, AuditService],
})
export class NotificationsModule {}
