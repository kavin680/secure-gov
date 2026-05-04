import {
  buildSearchFilter,
  buildSoftDeleteFilter,
  buildDateRangeFilter,
} from './query.helper';

describe('Query Helpers', () => {
  describe('buildSearchFilter', () => {
    it('should return undefined when no search term', () => {
      expect(buildSearchFilter(undefined, ['email'])).toBeUndefined();
    });

    it('should return undefined when fields are empty', () => {
      expect(buildSearchFilter('test', [])).toBeUndefined();
    });

    it('should build OR filter across fields', () => {
      const filter = buildSearchFilter('john', ['email', 'firstName']);

      expect(filter).toEqual({
        OR: [
          { email: { contains: 'john', mode: 'insensitive' } },
          { firstName: { contains: 'john', mode: 'insensitive' } },
        ],
      });
    });
  });

  describe('buildSoftDeleteFilter', () => {
    it('should filter out deleted records by default', () => {
      expect(buildSoftDeleteFilter()).toEqual({ deletedAt: null });
    });

    it('should include deleted records when flag is true', () => {
      expect(buildSoftDeleteFilter(true)).toEqual({});
    });
  });

  describe('buildDateRangeFilter', () => {
    it('should return undefined when no dates provided', () => {
      expect(buildDateRangeFilter('createdAt')).toBeUndefined();
    });

    it('should build filter with from date', () => {
      const from = new Date('2024-01-01');
      const filter = buildDateRangeFilter('createdAt', from);

      expect(filter).toEqual({ createdAt: { gte: from } });
    });

    it('should build filter with both dates', () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      const filter = buildDateRangeFilter('createdAt', from, to);

      expect(filter).toEqual({ createdAt: { gte: from, lte: to } });
    });
  });
});
