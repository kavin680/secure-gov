import { AuditInterceptor } from './audit.interceptor';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../modules/audit/audit.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditAction } from '../enums';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let reflector: Reflector;
  let auditService: Partial<AuditService>;

  beforeEach(() => {
    reflector = new Reflector();
    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    interceptor = new AuditInterceptor(reflector, auditService as AuditService);
  });

  function createMockContext(user?: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/api/v1/users',
          ip: '127.0.0.1',
          get: () => 'jest-agent',
          requestId: 'req-123',
          user,
          params: { id: 'resource-1' },
          body: { email: 'test@example.com', password: 'secret' },
        }),
        getResponse: jest.fn(),
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

  it('should skip audit when no metadata', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const context = createMockContext();
    const handler: CallHandler = { handle: () => of({ id: '1' }) };

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({ id: '1' });
      expect(auditService.log).not.toHaveBeenCalled();
      done();
    });
  });

  it('should create audit log when metadata present', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: AuditAction.CREATE,
      resource: 'User',
      description: 'User created',
    });
    const context = createMockContext({ sub: 'admin-1' });
    const handler: CallHandler = { handle: () => of({ id: '1' }) };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.CREATE,
            resource: 'User',
            userId: 'admin-1',
            requestId: 'req-123',
          }),
        );
        done();
      },
    });
  });

  it('should redact sensitive fields from body', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: AuditAction.CREATE,
      resource: 'User',
    });
    const context = createMockContext({ sub: 'admin-1' });
    const handler: CallHandler = { handle: () => of({ id: '1' }) };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        const logCall = (auditService.log as jest.Mock).mock.calls[0][0];
        expect(logCall.metadata.body.password).toBe('[REDACTED]');
        expect(logCall.metadata.body.email).toBe('test@example.com');
        done();
      },
    });
  });
});
