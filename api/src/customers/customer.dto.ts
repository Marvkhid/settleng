import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQuery } from '../common/pagination';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty({ message: 'Please enter the customer name.' })
  @MaxLength(120)
  name!: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: 'That email does not look right.' })
  email?: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  phone?: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: 'That email does not look right.' })
  email?: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  phone?: string;
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CustomerListQuery extends PaginationQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  owingOnly?: boolean;
}
