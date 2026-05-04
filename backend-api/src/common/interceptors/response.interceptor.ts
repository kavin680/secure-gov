import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        const result = data as Record<string, unknown> | undefined;
        const isPaginated = result && 'data' in result && 'meta' in result;

        return {
          success: true,
          statusCode: response.statusCode,
          message: (result?.message as string) || 'Success',
          data: isPaginated ? result.data : data,
          meta: isPaginated
            ? (result.meta as ApiResponse<T>['meta'])
            : undefined,
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
