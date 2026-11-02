import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_MESSAGE, DATE_REGEX } from '../common/dates';
import { MONEY_MESSAGE, MONEY_REGEX } from '../common/money';
import { PaginationQuery } from '../common/pagination';

export const DEBT_DIRECTIONS = ['OWED_TO_ME', 'I_OWE'] as const;
export const DEBT_OVERRIDES = ['DISPUTED', 'WRITTEN_OFF', 'CANCELLED'] as const;
export const DEBT_STATUSES = [
  'PENDING',
  'PARTIAL',
  'OVERDUE',
  'PAID',
  'DISPUTED',
  'WRITTEN_OFF',
  'CANCELLED',
] as const;
export const REPAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'POS'] as const;

export class CreateDebtDto {
  @IsString()
  @IsNotEmpty({ message: 'Who owes this money?' })
  @MaxLength(120)
  counterpartyName!: string;

  @IsOptional() @IsString() @MaxLength(40) counterpartyPhone?: string;
  @IsOptional() @IsString() @MaxLength(160) counterpartyEmail?: string;

  @IsIn(DEBT_DIRECTIONS, {
    message: 'Choose whether you are owed this money or you owe it.',
  })
  direction!: (typeof DEBT_DIRECTIONS)[number];

  @IsString() @Matches(MONEY_REGEX, { message: MONEY_MESSAGE }) principal!: string;

  @IsString()
  @IsNotEmpty({ message: 'Add a short description of the debt.' })
  @MaxLength(200)
  description!: string;

  @IsString() @Matches(DATE_REGEX, { message: DATE_MESSAGE }) incurredOn!: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  dueOn?: string;

  @IsOptional() @IsString() @MaxLength(500) terms?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() assignedToUserId?: string;
}

export class UpdateDebtDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) counterpartyName?: string;
  @IsOptional() @IsString() @MaxLength(40) counterpartyPhone?: string;
  @IsOptional() @IsString() @MaxLength(160) counterpartyEmail?: string;
  @IsOptional()
  @IsString()
  @Matches(MONEY_REGEX, { message: MONEY_MESSAGE })
  principal?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) description?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  incurredOn?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  dueOn?: string;
  @IsOptional() @IsString() @MaxLength(500) terms?: string;
  @IsOptional() @IsIn(DEBT_OVERRIDES, { message: 'Choose a valid status.' }) override?:
    | (typeof DEBT_OVERRIDES)[number]
    | null;
}

export class RecordRepaymentDto {
  @IsString() @Matches(MONEY_REGEX, { message: MONEY_MESSAGE }) amount!: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  paidOn?: string;
  @IsIn(REPAYMENT_METHODS, { message: 'Choose cash, bank transfer or POS.' })
  method!: (typeof REPAYMENT_METHODS)[number];
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class AssignDebtDto {
  @IsOptional() @IsString() userId?: string | null;
}

export class DebtListQuery extends PaginationQuery {
  @IsOptional() @IsIn(DEBT_DIRECTIONS) direction?: (typeof DEBT_DIRECTIONS)[number];
  @IsOptional() @IsIn(DEBT_STATUSES) status?: (typeof DEBT_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  from?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  to?: string;
}
