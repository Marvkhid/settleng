import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { tenantStore } from '../auth/tenant-context';
import { todayInLagos } from '../common/dates';
import {
  ExportQuery,
  PerformanceQuery,
  RangeQuery,
  SeriesQuery,
} from './report.dto';
import { ReportsService } from './reports.service';

/**
 * Empty shapes returned when a signed-in user has no workspace yet. A brand-new account can reach
 * these endpoints for a moment before onboarding completes; answering with zeros is kinder than a
 * 401 and, importantly, never lets a "not set up yet" state take the API down.
 */
const EMPTY_DASHBOARD = () => ({
  today: todayInLagos(),
  salesToday: '0.00',
  expensesToday: '0.00',
  moneyIn: '0.00',
  moneyOut: '0.00',
  customersOwing: { total: '0.00', customerCount: 0, invoiceCount: 0 },
  overdueInvoices: { count: 0, total: '0.00' },
  topDebtors: [],
  recentActivity: [],
});

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** True once the request has been resolved to a workspace the user belongs to. */
  private ready(): boolean {
    return Boolean(tenantStore()?.workspaceId);
  }

  @Get('dashboard') dashboard() {
    if (!this.ready()) return EMPTY_DASHBOARD();
    return this.reports.dashboard();
  }

  @Get('reports/summary') summary(@Query() q: RangeQuery) {
    const range = this.reports.resolveRange(q.from, q.to);
    if (!this.ready())
      return {
        range,
        sales: { total: '0.00', recorded: '0.00', onInvoices: '0.00' },
        expenses: { total: '0.00' },
        moneyIn: '0.00',
        moneyOut: '0.00',
        netRecordedMovement: '0.00',
        customersOwing: { total: '0.00', customerCount: 0, invoiceCount: 0 },
        overdueInvoices: { count: 0, total: '0.00' },
        expensesByCategory: [],
        incomeByCategory: [],
      };
    return this.reports.summary(range);
  }

  @Get('reports/timeseries') series(@Query() q: SeriesQuery) {
    if (!this.ready())
      return { period: q.period, from: '', to: '', points: [] };
    return this.reports.timeseries(q.period);
  }

  /** Business performance chart: revenue, expenses, profit and the change vs the previous period. */
  @Get('reports/performance')
  performance(@Query() q: PerformanceQuery) {
    return this.reports.performance(q.period);
  }

  @Get('reports/customers-owing') owing() {
    if (!this.ready()) return { items: [], total: '0.00', overdueTotal: '0.00' };
    return this.reports.customersOwing().then((o) => ({
      ...o,
      total: o.total.toFixed(2),
      overdueTotal: o.overdueTotal.toFixed(2),
    }));
  }

  @Get('reports/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @Query() q: ExportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.reports.exportCsv(
      q.type,
      this.reports.resolveRange(q.from, q.to),
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.filename}"`,
    );
    return out.body;
  }
}
