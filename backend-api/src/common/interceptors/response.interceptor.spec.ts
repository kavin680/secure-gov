import { ResponseInterceptor } from './response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  function createMockContext(
    requestId = 'test-request-id',
    statusCode = 200,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ requestId }),
        getResponse: () => ({ statusCode }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('should wrap response data in standard format', (done) => {
    const context = createMockContext();
    const handler: CallHandler = { handle: () => of({ name: 'test' }) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Success');
      expect(result.data).toEqual({ name: 'test' });
      expect(result.requestId).toBe('test-request-id');
      expect(result.timestamp).toBeDefined();
      done();
    });
  });

  it('should use message from data if provided', (done) => {
    const context = createMockContext();
    const handler: CallHandler = {
      handle: () => of({ message: 'Custom message', id: '1' }),
    };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.message).toBe('Custom message');
      done();
    });
  });

  it('should handle paginated response with meta', (done) => {
    const context = createMockContext();
    const paginatedData = {
      data: [{ id: '1' }],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    const handler: CallHandler = { handle: () => of(paginatedData) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.data).toEqual([{ id: '1' }]);
      expect(result.meta).toEqual(paginatedData.meta);
      done();
    });
  });

  it('should handle null/undefined data', (done) => {
    const context = createMockContext();
    const handler: CallHandler = { handle: () => of(undefined) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.message).toBe('Success');
      done();
    });
  });
});
