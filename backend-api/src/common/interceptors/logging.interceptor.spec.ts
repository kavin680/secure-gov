import { LoggingInterceptor } from './logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  function createMockContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/v1/test',
          ip: '127.0.0.1',
          get: () => 'jest-agent',
          requestId: 'req-123',
        }),
        getResponse: () => ({ statusCode: 200 }),
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

  it('should log request and response', (done) => {
    const context = createMockContext();
    const handler: CallHandler = { handle: () => of({ data: 'test' }) };

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        // just verify it completes without error
      },
      complete: () => done(),
    });
  });

  it('should pass through the response data unchanged', (done) => {
    const context = createMockContext();
    const responseData = { id: '1', name: 'test' };
    const handler: CallHandler = { handle: () => of(responseData) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual(responseData);
      done();
    });
  });
});
