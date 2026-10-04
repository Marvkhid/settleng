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

export const TXN_METHODS = ['CASH', 'BANK_TRANSFER', 'POS'] as const;
export const SALE_METHODS = ['CASH', 'BANK_TRANSFER', 'POS', 'CREDIT'] as const;

export class RecordSaleDto {
  @IsString() @Matches(MONEY_REGEX, { message: MONEY_MESSAGE }) amount!: string;
  @IsIn(SALE_METHODS, { message: 'Choose Cash, Bank transfer, POS or Credit.' })
  paymentMethod!: (typeof SALE_METHODS)[number];
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  date?: string;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
}

export class RecordExpenseDto {
  @IsString() @Matches(MONEY_REGEX, { message: MONEY_MESSAGE }) amount!: string;
  @IsString()
  @IsNotEmpty({
    message: 'Please choose or type a category, for example Stock.',
  })
  @MaxLength(60)
  category!: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  date?: string;
  @IsOptional() @IsIn(TXN_METHODS) paymentMethod?: (typeof TXN_METHODS)[number];
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
}

export class CreateTransactionDto {
  @IsIn(['INCOME', 'EXPENSE']) type!: 'INCOME' | 'EXPENSE';
  @IsString() @Matches(MONEY_REGEX, { message: MONEY_MESSAGE }) amount!: string;
  @IsString() @IsNotEmpty() @MaxLength(60) category!: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  date?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsIn(TXN_METHODS) paymentMethod?: (typeof TXN_METHODS)[number];
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() customerId?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  @Matches(MONEY_REGEX, { message: MONEY_MESSAGE })
  amount?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) category?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  date?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsIn(TXN_METHODS) paymentMethod?: (typeof TXN_METHODS)[number];
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
}

export class TransactionListQuery extends PaginationQuery {
  @IsOptional() @IsIn(['INCOME', 'EXPENSE']) type?: 'INCOME' | 'EXPENSE';
  @IsOptional() @IsIn(['MANUAL', 'INVOICE_PAYMENT', 'IMPORTED']) source?:
    'MANUAL' | 'INVOICE_PAYMENT' | 'IMPORTED';
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  from?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  to?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
