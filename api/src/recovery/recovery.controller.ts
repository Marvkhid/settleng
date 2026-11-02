import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { currentUserEmail, currentUserId, requireRole } from '../auth/tenant-context';
import { requireBusinessId } from '../common/business';
import { CreateReminderDto } from './recovery.dto';
import { RecoveryService } from './recovery.service';
import { DocumentsService, MAX_DOCUMENT_BYTES } from './documents.service';

@ApiTags('recovery')
@Controller()
export class RecoveryController {
  constructor(
    private readonly recovery: RecoveryService,
    private readonly documents: DocumentsService,
  ) {}

  // ---------------------------------------------------------------- payment requests

  @Post('debts/:id/payment-requests')
  createPaymentRequest(@Param('id') id: string, @Body() body: { days?: number }) {
    const days = Math.min(Math.max(Number(body?.days ?? 30) || 30, 1), 365);
    return this.recovery.createPaymentRequest(id, days);
  }

  @Post('debts/:id/payment-requests/:requestId/revoke')
  revokePaymentRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.recovery.revokePaymentRequest(id, requestId);
  }

  // ---------------------------------------------------------------- reminders

  @Post('debts/:id/reminders')
  createReminder(@Param('id') id: string, @Body() dto: CreateReminderDto) {
    return this.recovery.createReminder(id, dto);
  }

  /** One-click send: schedule for today, then deliver immediately. */
  @Post('debts/:id/reminders/send')
  sendNow(@Param('id') id: string, @Body() dto: CreateReminderDto) {
    return this.recovery.createAndSend(id, dto);
  }

  @Post('debts/:id/reminders/:reminderId/send')
  sendExisting(
    @Param('id') id: string,
    @Param('reminderId') reminderId: string,
  ) {
    return this.recovery.sendNow(id, reminderId);
  }

  @Delete('debts/:id/reminders/:reminderId')
  cancelReminder(
    @Param('id') id: string,
    @Param('reminderId') reminderId: string,
  ) {
    return this.recovery.cancelReminder(id, reminderId);
  }

  @Get('recovery/upcoming') upcoming() {
    return this.recovery.upcoming();
  }

  @Get('recovery/notifications') notifications(@Query('limit') limit?: string) {
    return this.recovery.notifications(Number(limit ?? 50) || 50);
  }

  @Get('recovery/status')
  async status() {
    const log = await this.recovery.notifications(1);
    return {
      configured: log.configured,
      email: currentUserEmail(),
      canManage: true,
    };
  }

  /**
   * Scheduler entry point. Public because the caller is a cron job without a user token; it is
   * protected by CRON_SECRET and answers 404 when no secret is configured.
   */
  @Public()
  @Post('internal/reminders/dispatch')
  dispatch(@Headers('x-cron-secret') secret?: string) {
    return this.recovery.dispatchDue(secret);
  }

  // ---------------------------------------------------------------- documents

  @Post('debts/:id/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  upload(
    @Param('id') debtId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new Error('Choose a file to upload.');
    return this.documents.upload({
      workspaceId: requireBusinessId(),
      debtId,
      userId: currentUserId(),
      filename: file.originalname,
      mime: file.mimetype,
      buffer: file.buffer,
    });
  }

  @Get('documents/:documentId/link')
  link(@Param('documentId') documentId: string) {
    requireRole('OWNER', 'MANAGER', 'STAFF');
    return this.documents.signedUrl(requireBusinessId(), documentId);
  }
}
