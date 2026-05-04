import { PaginationMeta } from './pagination.interface';

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  requestId?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  errorCode?: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
  path?: string;
  stack?: string; // only in development
}
