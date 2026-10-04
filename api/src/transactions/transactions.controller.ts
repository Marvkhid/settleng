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
  CreateTransactionDto,
  RecordExpenseDto,
  RecordSaleDto,
  TransactionListQuery,
  UpdateTransactionDto,
} from './transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller()
export class TransactionsController {
  constructor(private readonly txns: TransactionsService) {}

  @Get('transactions') list(@Query() q: TransactionListQuery) {
    return this.txns.list(q);
  }
  @Get('transactions/categories') categories() {
    return this.txns.categories();
  }
  @Get('transactions/:id') get(@Param('id') id: string) {
    return this.txns.get(id);
  }
  @Post('transactions') create(@Body() dto: CreateTransactionDto) {
    return this.txns.createManual(dto);
  }
  @Patch('transactions/:id') update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.txns.update(id, dto);
  }
  @Delete('transactions/:id') @HttpCode(204) async remove(
    @Param('id') id: string,
  ) {
    await this.txns.remove(id);
  }

  /** Quick actions: no invoice needed. */
  @Post('sales') recordSale(@Body() dto: RecordSaleDto) {
    return this.txns.recordSale(dto);
  }
  @Post('expenses') recordExpense(@Body() dto: RecordExpenseDto) {
    return this.txns.recordExpense(dto);
  }
}
