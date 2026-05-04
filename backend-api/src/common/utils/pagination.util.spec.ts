import {
  buildPaginationMeta,
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from './pagination.util';
import { PaginationQueryDto } from '../dtos';

describe('Pagination Utilities', () => {
  describe('buildPaginationMeta', () => {
    it('should build correct meta for first page', () => {
      const query: PaginationQueryDto = { page: 1, limit: 10 };
      const meta = buildPaginationMeta(query, 25);

      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('should build correct meta for last page', () => {
      const query: PaginationQueryDto = { page: 3, limit: 10 };
      const meta = buildPaginationMeta(query, 25);

      expect(meta).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('should use defaults when page/limit not provided', () => {
      const query: PaginationQueryDto = {};
      const meta = buildPaginationMeta(query, 50);

      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(3);
    });

    it('should handle zero total', () => {
      const query: PaginationQueryDto = { page: 1, limit: 10 };
      const meta = buildPaginationMeta(query, 0);

      expect(meta.total).toBe(0);
      expect(meta.totalPages).toBe(0);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });
  });

  describe('buildPaginatedResult', () => {
    it('should wrap data with pagination meta', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const query: PaginationQueryDto = { page: 1, limit: 10 };
      const result = buildPaginatedResult(data, query, 2);

      expect(result.data).toEqual(data);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('buildPrismaQueryOptions', () => {
    it('should compute skip and take from page/limit', () => {
      const query: PaginationQueryDto = { page: 2, limit: 15 };
      const options = buildPrismaQueryOptions(query);

      expect(options.skip).toBe(15);
      expect(options.take).toBe(15);
    });

    it('should use defaults when not provided', () => {
      const query: PaginationQueryDto = {};
      const options = buildPrismaQueryOptions(query);

      expect(options.skip).toBe(0);
      expect(options.take).toBe(20);
      expect(options.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('should use custom sort fields', () => {
      const query: PaginationQueryDto = {
        sortBy: 'email',
        sortOrder: 'asc',
      };
      const options = buildPrismaQueryOptions(query);

      expect(options.orderBy).toEqual({ email: 'asc' });
    });
  });
});
