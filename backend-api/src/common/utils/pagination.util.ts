import { PaginationMeta, PaginatedResult } from '../interfaces';
import { PaginationQueryDto } from '../dtos';

export function buildPaginationMeta(
  query: PaginationQueryDto,
  total: number,
): PaginationMeta {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function buildPaginatedResult<T>(
  data: T[],
  query: PaginationQueryDto,
  total: number,
): PaginatedResult<T> {
  return {
    data,
    meta: buildPaginationMeta(query, total),
  };
}

export function buildPrismaQueryOptions(query: PaginationQueryDto) {
  const page = query.page || 1;
  const limit = query.limit || 20;

  return {
    skip: (page - 1) * limit,
    take: limit,
    orderBy: query.sortBy
      ? { [query.sortBy]: query.sortOrder || 'desc' }
      : { createdAt: 'desc' as const },
  };
}
