import { RequestIdMiddleware } from './request-id.middleware';
import { Request, Response } from 'express';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  function createMockReqRes(headers: Record<string, string> = {}) {
    const req = { headers } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();
    return { req, res, next };
  }

  it('should generate a request ID when none provided', () => {
    const { req, res, next } = createMockReqRes();
    middleware.use(req, res, next);

    const requestId = (req as unknown as Record<string, unknown>).requestId;
    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe('string');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', requestId);
    expect(next).toHaveBeenCalled();
  });

  it('should use provided x-request-id header', () => {
    const { req, res, next } = createMockReqRes({
      'x-request-id': 'custom-id',
    });
    middleware.use(req, res, next);

    const requestId = (req as unknown as Record<string, unknown>).requestId;
    expect(requestId).toBe('custom-id');
  });

  it('should set correlation ID to request ID when not provided', () => {
    const { req, res, next } = createMockReqRes();
    middleware.use(req, res, next);

    const requestId = (req as unknown as Record<string, unknown>).requestId;
    const correlationId = (req as unknown as Record<string, unknown>)
      .correlationId;
    expect(correlationId).toBe(requestId);
  });

  it('should use provided x-correlation-id header', () => {
    const { req, res, next } = createMockReqRes({
      'x-correlation-id': 'custom-correlation',
    });
    middleware.use(req, res, next);

    const correlationId = (req as unknown as Record<string, unknown>)
      .correlationId;
    expect(correlationId).toBe('custom-correlation');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      'custom-correlation',
    );
  });
});
