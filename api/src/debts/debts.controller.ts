import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AssignDebtDto,
  CreateDebtDto,
  DebtListQuery,
  RecordRepaymentDto,
  UpdateDebtDto,
} from './debt.dto';
import { DebtsService } from './debts.service';

@ApiTags('debts')
@Controller('debts')
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  @Get() list(@Query() q: DebtListQuery) {
    return this.debts.list(q);
  }

  @Get('summary') summary() {
    return this.debts.summary();
  }

  @Get('analytics') analytics() {
    return this.debts.analytics();
  }

  @Get(':id') get(@Param('id') id: string) {
    return this.debts.get(id);
  }

  @Post() create(@Body() dto: CreateDebtDto) {
    return this.debts.create(dto);
  }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDebtDto) {
    return this.debts.update(id, dto);
  }

  @Patch(':id/assign') assign(@Param('id') id: string, @Body() dto: AssignDebtDto) {
    return this.debts.assign(id, dto);
  }

  @Post(':id/repayments') repayment(
    @Param('id') id: string,
    @Body() dto: RecordRepaymentDto,
  ) {
    return this.debts.recordRepayment(id, dto);
  }

  @Delete(':id') remove(@Param('id') id: string) {
    return this.debts.remove(id);
  }
}
