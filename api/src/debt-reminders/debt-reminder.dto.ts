import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export const FREQUENCIES = [
  'ONCE_DAILY',
  'TWICE_DAILY',
  'THREE_TIMES_DAILY',
  'CUSTOM',
] as const;

export class SaveDebtReminderDto {
  @IsBoolean() enabled!: boolean;

  @IsIn(FREQUENCIES, { message: 'Choose a reminder frequency.' })
  frequency!: (typeof FREQUENCIES)[number];

  @IsArray()
  @IsString({ each: true })
  times!: string[];

  @IsOptional() @IsString() timezone?: string;

  @IsOptional() @IsBoolean() paused?: boolean;
}

export class PauseReminderDto {
  @IsBoolean() paused!: boolean;
}
