import { Module } from '@nestjs/common';
import { DebtsModule } from '../debts/debts.module';
import { DocumentsService } from './documents.service';
import { NotificationProviders } from './notification.provider';
import { PublicRecoveryController } from './public-recovery.controller';
import { RecoveryController } from './recovery.controller';
import { RecoveryService } from './recovery.service';

@Module({
  imports: [DebtsModule],
  controllers: [RecoveryController, PublicRecoveryController],
  providers: [RecoveryService, NotificationProviders, DocumentsService],
  exports: [NotificationProviders],
})
export class RecoveryModule {}
