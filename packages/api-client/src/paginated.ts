export interface Paginated<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

function numberAt(bag: Record<string, unknown>, key: string): number | undefined {
  const value = bag[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function paginated<T>(response: unknown, key?: string): Paginated<T> {
  if (Array.isArray(response)) {
    return { data: response as T[] };
  }
  const bag = (response ?? {}) as Record<string, unknown>;
  const raw = (key ? bag[key] : undefined) ?? bag.data ?? bag.records ?? [];
  const data = Array.isArray(raw) ? (raw as T[]) : [];
  const limit = numberAt(bag, "limit") ?? Math.max(data.length, 1);
  const total = numberAt(bag, "total") ?? numberAt(bag, "totalItems") ?? data.length;
  const page = numberAt(bag, "page") ?? 1;
  const pageCount = numberAt(bag, "pageCount") ?? numberAt(bag, "totalPages");
  const totalPages = Math.max(pageCount ?? Math.ceil(total / Math.max(limit, 1)), 1);
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
