import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { DATE_MESSAGE, DATE_REGEX } from '../common/dates';

export class RangeQuery {
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  from?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX, { message: DATE_MESSAGE })
  to?: string;
}
export class SeriesQuery {
  @IsOptional() @IsIn(['7d', '30d', '90d']) period: '7d' | '30d' | '90d' = '7d';
}
export class ExportQuery extends RangeQuery {
  @IsIn(['transactions', 'invoices', 'customers-owing']) type!:
    'transactions' | 'invoices' | 'customers-owing';
}
