// Pagination interface for API responses
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// New pagination interface
export interface IPaginatedData<T = any> {
  name: string;
  size: number;
  pageCount: number;
  limit: number;
  page: number;
  previousPage: number | null;
  nextPage: number | null;
  totalItems: number;
  records: T[];
}
