export function buildSearchFilter(
  search: string | undefined,
  fields: string[],
): Record<string, unknown> | undefined {
  if (!search || fields.length === 0) return undefined;

  return {
    OR: fields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    })),
  };
}

export function buildSoftDeleteFilter(
  includeDeleted = false,
): Record<string, unknown> {
  if (includeDeleted) return {};
  return { deletedAt: null };
}

export function buildDateRangeFilter(
  field: string,
  from?: Date,
  to?: Date,
): Record<string, unknown> | undefined {
  if (!from && !to) return undefined;

  const filter: Record<string, unknown> = {};
  if (from) filter.gte = from;
  if (to) filter.lte = to;

  return { [field]: filter };
}
