import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002': {
        // Unique constraint violation
        statusCode = HttpStatus.CONFLICT;
        const target =
          (exception.meta?.target as string[])?.join(', ') ?? 'field';
        message = `Unique constraint violation on: ${target}`;
        break;
      }
      case 'P2025': {
        // Record not found
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      }
      case 'P2003': {
        // Foreign key constraint
        statusCode = HttpStatus.BAD_REQUEST;
        const field = (exception.meta?.field_name as string) ?? 'field';
        message = `Related record not found for: ${field}`;
        break;
      }
      default:
        this.logger.error(`Prisma error ${exception.code}`, exception.message);
    }

    response.status(statusCode).json({
      error: { statusCode, message },
    });
  }
}
