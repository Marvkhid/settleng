import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DATE_MESSAGE, DATE_REGEX } from '../common/dates';

export const REMINDER_CHANNELS = ['EMAIL', 'WHATSAPP', 'SMS'] as const;
export const REMINDER_TEMPLATES = ['friendly', 'firm'] as const;

export class CreateReminderDto {
  @IsIn(REMINDER_CHANNELS, { message: 'Choose email, WhatsApp or SMS.' })
  channel!: (typeof REMINDER_CHANNELS)[number];

  /** The day to send on, YYYY-MM-DD. Defaults to today (sent immediately when dispatched). */
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  scheduledFor?: string;

  @IsOptional()
  @IsIn(REMINDER_TEMPLATES, { message: 'Choose a reminder tone.' })
  templateKey?: (typeof REMINDER_TEMPLATES)[number];

  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
