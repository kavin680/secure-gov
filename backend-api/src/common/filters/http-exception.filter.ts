import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../interfaces';
import { ErrorCode } from '../enums';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let errorCode: string | undefined;
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || message;
        error = (resp.error as string) || error;
        errorCode = resp.errorCode as string;

        if (Array.isArray(resp.message)) {
          details = resp.message;
          message = 'Validation failed';
        }
      }
    } else if (this.isPrismaError(exception)) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      message = mapped.message;
      error = mapped.error;
      errorCode = mapped.errorCode;
    } else if (exception instanceof Error) {
      message = isProduction ? 'Internal server error' : exception.message;
    }

    const requestId = (request as unknown as Record<string, unknown>)
      .requestId as string | undefined;

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode: status,
      message,
      error,
      errorCode,
      details,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (!isProduction && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }

  private isPrismaError(exception: unknown): boolean {
    if (!exception || typeof exception !== 'object') return false;
    const name = (exception as Record<string, unknown>).constructor?.name;
    return (
      name === 'PrismaClientKnownRequestError' ||
      name === 'PrismaClientValidationError'
    );
  }

  private mapPrismaError(exception: unknown): {
    status: number;
    message: string;
    error: string;
    errorCode: string;
  } {
    const prismaError = exception as {
      code?: string;
      meta?: { target?: string[] };
    };

    switch (prismaError.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${prismaError.meta?.target?.join(', ') || 'value'} already exists`,
          error: 'Conflict',
          errorCode: ErrorCode.UNIQUE_CONSTRAINT,
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
          errorCode: ErrorCode.RECORD_NOT_FOUND,
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint failed',
          error: 'Bad Request',
          errorCode: ErrorCode.FOREIGN_KEY_CONSTRAINT,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'Internal Server Error',
          errorCode: ErrorCode.DATABASE_ERROR,
        };
    }
  }
}
