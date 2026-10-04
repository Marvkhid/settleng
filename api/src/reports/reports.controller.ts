import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ExportQuery, RangeQuery, SeriesQuery } from './report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard') dashboard() {
    return this.reports.dashboard();
  }
  @Get('reports/summary') summary(@Query() q: RangeQuery) {
    return this.reports.summary(this.reports.resolveRange(q.from, q.to));
  }
  @Get('reports/timeseries') series(@Query() q: SeriesQuery) {
    return this.reports.timeseries(q.period);
  }
  @Get('reports/customers-owing') owing() {
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
