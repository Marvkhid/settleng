import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_MESSAGE, DATE_REGEX } from '../common/dates';
import { MONEY_MESSAGE, MONEY_REGEX } from '../common/money';

export const RECEIVABLE_METHODS = ['CASH', 'BANK_TRANSFER', 'POS'] as const;
export type ReceivableMethod = (typeof RECEIVABLE_METHODS)[number];

export class RecordPaymentDto {
  @IsString() @Matches(MONEY_REGEX, { message: MONEY_MESSAGE }) amount!: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  paymentDate?: string;
  @IsIn(RECEIVABLE_METHODS, { message: 'Choose Cash, Bank transfer or POS.' })
  method!: ReceivableMethod;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
}
