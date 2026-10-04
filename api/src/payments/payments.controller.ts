import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RecordPaymentDto } from './payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('invoices/:id/payments')
  list(@Param('id') id: string) {
    return this.payments.listForInvoice(id);
  }

  @Post('invoices/:id/payments')
  @HttpCode(201)
  record(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.payments.recordForInvoice(id, dto);
  }

  @Post('customers/:id/payments')
  @HttpCode(201)
  customerPaid(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.payments.recordForCustomer(id, dto);
  }
}
