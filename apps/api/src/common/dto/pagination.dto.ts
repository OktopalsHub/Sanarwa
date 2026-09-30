import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class PaginationDto {
  @ApiPropertyOptional({
    description: "Page number (1-based)",
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Number of items per page",
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export type IPaginationOption = {
  page: string | number;
  limit?: string | number;
};

export type IPaginatedData<T = any> = {
  name: string;
  size: number;
  pageCount: number;
  limit: number;
  page: number;
  previousPage: number | null;
  nextPage: number | null;
  totalItems: number;
  records: T[];
};

// Additional pagination interfaces for different response formats
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }
}

// Utility function to create pagination summary
export async function getPaginationSummary(
  records: any[],
  totalItems: number,
  options: IPaginationOption,
  name?: string,
): Promise<IPaginatedData> {
  let limit = parseInt(String(options.limit), 10);
  limit = limit < 1 ? 10 : limit;
  const page = Math.max(parseInt(String(options.page), 10), 1);
  const pageCount = Math.ceil(totalItems / limit) || 1;

  return {
    name: name || "Unknown",
    size: records.length,
    limit,
    pageCount,
    page,
    previousPage: page > 1 ? Math.min(page - 1, pageCount) : null,
    nextPage: page < pageCount ? page + 1 : null,
    totalItems,
    records,
  };
}

// New pagination response class using the new format
export class PaginatedDataResponse<T> {
  name: string;
  size: number;
  pageCount: number;
  limit: number;
  page: number;
  previousPage: number | null;
  nextPage: number | null;
  totalItems: number;
  records: T[];

  constructor(data: T[], total: number, page: number, limit: number, name: string = "data") {
    this.name = name;
    this.size = data.length;
    this.pageCount = Math.ceil(total / limit);
    this.limit = limit;
    this.page = page;
    this.previousPage = page > 1 ? page - 1 : null;
    this.nextPage = page < Math.ceil(total / limit) ? page + 1 : null;
    this.totalItems = total;
    this.records = data;
  }
}
