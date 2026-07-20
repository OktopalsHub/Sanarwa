import { DeepPartial, DeleteResult, UpdateResult } from 'typeorm';

export interface IBaseRepository<T> {
  findAll(includeDeleted?: boolean): Promise<T[]>;
  findById(id: string | number, includeDeleted?: boolean): Promise<T | null>;
  create(data: DeepPartial<T>): Promise<T>;
  update(id: string | number, data: DeepPartial<T>): Promise<T | null>;
  delete(id: string | number): Promise<DeleteResult>;
  softDelete(id: string | number): Promise<DeleteResult>;
  restore(id: string | number): Promise<UpdateResult>;
  findAllPaginated(
    page: number,
    limit: number,
    includeDeleted?: boolean,
    where?: any,
    relations?: string[],
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
}
