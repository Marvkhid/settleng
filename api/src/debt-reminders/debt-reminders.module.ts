import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { RecoveryModule } from '../recovery/recovery.module';
import { DebtRemindersController } from './debt-reminders.controller';
import { DebtRemindersService } from './debt-reminders.service';

@Module({
  imports: [CommonModule, RecoveryModule],
  controllers: [DebtRemindersController],
  providers: [DebtRemindersService],
  exports: [DebtRemindersService],
})
export class DebtRemindersModule {}
