import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateCustomerDto,
  CustomerListQuery,
  UpdateCustomerDto,
} from './customer.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get() list(@Query() q: CustomerListQuery) {
    return this.customers.list(q);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.customers.get(id);
  }
  @Post() create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(id, dto);
  }
  @Post(':id/archive') @HttpCode(200) archive(@Param('id') id: string) {
    return this.customers.setArchived(id, true);
  }
  @Post(':id/restore') @HttpCode(200) restore(@Param('id') id: string) {
    return this.customers.setArchived(id, false);
  }
}
