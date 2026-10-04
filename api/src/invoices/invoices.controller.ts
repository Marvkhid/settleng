import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateInvoiceDto,
  InvoiceListQuery,
  UpdateInvoiceDto,
} from './invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}
  @Get() list(@Query() q: InvoiceListQuery) {
    return this.invoices.list(q);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.invoices.get(id);
  }
  @Post() create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.create(dto);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto);
  }
  @Post(':id/issue') @HttpCode(200) issue(@Param('id') id: string) {
    return this.invoices.issue(id);
  }
  @Post(':id/void') @HttpCode(200) void(@Param('id') id: string) {
    return this.invoices.void(id);
  }
  @Delete(':id') @HttpCode(204) async remove(@Param('id') id: string) {
    await this.invoices.deleteDraft(id);
  }
}
