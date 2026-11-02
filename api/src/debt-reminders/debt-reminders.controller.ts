import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { DebtRemindersService } from './debt-reminders.service';
import { PauseReminderDto, SaveDebtReminderDto } from './debt-reminder.dto';

@ApiTags('debt-reminders')
@Controller()
export class DebtRemindersController {
  constructor(private readonly reminders: DebtRemindersService) {}

  @Get('debts/:id/reminder')
  config(@Param('id') id: string) {
    return this.reminders.configForDebt(id);
  }

  @Put('debts/:id/reminder')
  save(@Param('id') id: string, @Body() dto: SaveDebtReminderDto) {
    return this.reminders.save(id, dto);
  }

  @Post('debts/:id/reminder/pause')
  @HttpCode(200)
  pause(@Param('id') id: string, @Body() dto: PauseReminderDto) {
    return this.reminders.setPaused(id, dto.paused);
  }

  @Delete('debts/:id/reminder')
  disable(@Param('id') id: string) {
    return this.reminders.disable(id);
  }

  @Get('debt-reminders')
  overview() {
    return this.reminders.overview();
  }

  /** Sends one real reminder email now, so the owner can see exactly what will arrive. */
  @Post('debt-reminders/test')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  test() {
    return this.reminders.sendTest();
  }

  /**
   * Scheduler entry point. Public because the caller is a cron job, protected by CRON_SECRET, and
   * 404 when no secret is configured so the endpoint cannot even be probed.
   */
  @Public()
  @Post('internal/debt-reminders/dispatch')
  dispatch(
    @Headers('x-cron-secret') secret?: string,
    @Query('at') at?: string,
  ) {
    return this.reminders.dispatchDue(secret, at);
  }
}
