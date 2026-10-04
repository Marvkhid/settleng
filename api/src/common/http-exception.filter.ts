import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Consistent error body: { statusCode, error, message, details? }. Never leaks internals. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong on our side. Please try again.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const b = body as { message?: string | string[] };
        if (Array.isArray(b.message)) {
          message = 'Please check the highlighted fields.';
          details = b.message;
        } else if (b.message) message = b.message;
      }
    } else {
      const code = (exception as { code?: string })?.code;
      if (code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'That record already exists.';
      } else if (code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'We could not find that record.';
      } else if (code === 'P2003') {
        status = HttpStatus.CONFLICT;
        message =
          'This record is linked to other records and cannot be changed that way.';
      } else
        this.log.error(
          exception instanceof Error
            ? (exception.stack ?? exception.message)
            : String(exception),
        );
    }
    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      ...(details ? { details } : {}),
    });
  }
}
