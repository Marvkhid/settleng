import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { ReconciliationService } from './reconciliation.service';
import { MAX_FILE_BYTES } from './statement-parser';

class ConfirmDto {
  @IsOptional() @IsString() invoiceId?: string;
}
const upload = FileInterceptor('file', {
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

@ApiTags('reconciliation')
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly rec: ReconciliationService) {}

  @Get('template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  template(@Res({ passthrough: true }) res: Response) {
    const t = this.rec.template();
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${t.filename}"`,
    );
    return t.body;
  }

  @Post('preview')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload)
  preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('mapping') mapping?: string,
  ) {
    return this.rec.preview(file, mapping);
  }

  @Post('imports')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload)
  save(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('mapping') mapping?: string,
  ) {
    return this.rec.save(file, mapping);
  }

  @Get('imports') list() {
    return this.rec.listImports();
  }
  @Get('imports/:id') get(@Param('id') id: string) {
    return this.rec.getImport(id);
  }

  @Post('rows/:rowId/confirm')
  @HttpCode(200)
  confirm(@Param('rowId') rowId: string, @Body() dto: ConfirmDto) {
    return this.rec.confirm(rowId, dto.invoiceId);
  }

  @Post('rows/:rowId/reject')
  @HttpCode(200)
  reject(@Param('rowId') rowId: string) {
    return this.rec.reject(rowId);
  }
}
