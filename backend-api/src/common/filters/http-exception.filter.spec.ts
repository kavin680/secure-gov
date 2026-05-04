import { GlobalExceptionFilter } from './http-exception.filter';
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ArgumentsHost,
} from '@nestjs/common';
import { ErrorCode } from '../enums';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: Record<string, unknown>;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/v1/test',
      requestId: 'test-request-id',
    };
  });

  function createMockHost(): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ArgumentsHost;
  }

  it('should handle HttpException', () => {
    const exception = new BadRequestException('Bad input');
    filter.catch(exception, createMockHost());

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        requestId: 'test-request-id',
        path: '/api/v1/test',
      }),
    );
  });

  it('should handle validation errors with array of messages', () => {
    const exception = new BadRequestException({
      message: ['email must be valid', 'password is too weak'],
      error: 'Bad Request',
    });
    filter.catch(exception, createMockHost());

    const jsonArg = mockResponse.json.mock.calls[0][0];
    expect(jsonArg.message).toBe('Validation failed');
    expect(jsonArg.details).toEqual([
      'email must be valid',
      'password is too weak',
    ]);
  });

  it('should handle NotFoundException', () => {
    const exception = new NotFoundException('User not found');
    filter.catch(exception, createMockHost());

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('should handle generic Error', () => {
    const exception = new Error('Something broke');
    filter.catch(exception, createMockHost());

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

  it('should handle Prisma P2002 unique constraint error', () => {
    const prismaError = Object.create(Error.prototype);
    prismaError.constructor = { name: 'PrismaClientKnownRequestError' };
    prismaError.code = 'P2002';
    prismaError.meta = { target: ['email'] };
    Object.defineProperty(prismaError, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });

    filter.catch(prismaError, createMockHost());

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const jsonArg = mockResponse.json.mock.calls[0][0];
    expect(jsonArg.errorCode).toBe(ErrorCode.UNIQUE_CONSTRAINT);
  });

  it('should handle Prisma P2025 record not found error', () => {
    const prismaError = {
      code: 'P2025',
    };
    Object.defineProperty(prismaError, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });

    filter.catch(prismaError, createMockHost());

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const jsonArg = mockResponse.json.mock.calls[0][0];
    expect(jsonArg.errorCode).toBe(ErrorCode.RECORD_NOT_FOUND);
  });

  it('should include timestamp in error response', () => {
    const exception = new HttpException('Error', 500);
    filter.catch(exception, createMockHost());

    const jsonArg = mockResponse.json.mock.calls[0][0];
    expect(jsonArg.timestamp).toBeDefined();
  });
});
