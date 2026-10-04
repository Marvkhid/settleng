import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DATE_MESSAGE, DATE_REGEX } from '../common/dates';
import {
  MONEY_MESSAGE,
  MONEY_REGEX,
  QTY_MESSAGE,
  QTY_REGEX,
} from '../common/money';
import { PaginationQuery } from '../common/pagination';

export class InvoiceItemDto {
  @IsString() @IsNotEmpty() @MaxLength(200) description!: string;
  @IsString() @Matches(QTY_REGEX, { message: QTY_MESSAGE }) quantity!: string;
  @IsString()
  @Matches(MONEY_REGEX, { message: MONEY_MESSAGE })
  unitPrice!: string;
}

export class CreateInvoiceDto {
  @IsString() @IsNotEmpty() customerId!: string;
  @IsOptional() @IsString() @MaxLength(40) invoiceNumber?: string;
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  issueDate!: string;
  @IsString() @Matches(DATE_REGEX, { message: DATE_MESSAGE }) dueDate!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
  @IsOptional() @IsBoolean() saveAsDraft?: boolean;
}

export class UpdateInvoiceDto {
  @IsOptional() @IsString() @IsNotEmpty() customerId?: string;
  @IsOptional() @IsString() @MaxLength(40) invoiceNumber?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  issueDate?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  dueDate?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}

export const INVOICE_STATUSES = [
  'DRAFT',
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOID',
] as const;

export class InvoiceListQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: (typeof INVOICE_STATUSES)[number];
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
