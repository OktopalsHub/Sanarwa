import {
  DeepPartial,
  DeleteResult,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
  UpdateResult,
} from 'typeorm';
import { IBaseRepository } from './base.repository.interface';

export class BaseRepository<T extends ObjectLiteral>
  implements IBaseRepository<T>
{
  constructor(private readonly repository: Repository<T>) {}

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  async findAll(
    includeDeleted = false,
    where: FindManyOptions<T>['where'] = {},
    relations: string[] = [],
  ): Promise<T[]> {
    const options: FindManyOptions<T> = {
      withDeleted: includeDeleted,
      relations,
    };

    if (where) {
      options.where = where;
    }

    return this.repository.find(options);
  }

  async findById(
    id: string,
    includeDeleted = false,
    additionalWhere: FindOneOptions<T>['where'] = {},
    relations: string[] = [],
  ): Promise<T | null> {
    const options: FindOneOptions<T> = {
      withDeleted: includeDeleted,
      relations,
      where: {
        ...additionalWhere,
        id,
      } as any,
    };

    return this.repository.findOne(options);
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    const entity = await this.findById(id);
    if (!entity) return null;

    const merged = this.repository.merge(entity, data);
    return this.repository.save(merged);
  }

  async delete(id: string): Promise<DeleteResult> {
    return this.repository.delete(id);
  }

  async softDelete(id: string): Promise<DeleteResult> {
    return this.repository.softDelete(id);
  }

  async restore(id: string): Promise<UpdateResult> {
    return this.repository.restore(id);
  }

  async count(where: Partial<T>): Promise<number> {
    return this.repository.count({ where });
  }

  async findAllPaginated(
    page: number,
    limit: number,
    includeDeleted = false,
    where: FindManyOptions<T>['where'] = {},
    relations: string[] = [],
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const options: FindManyOptions<T> = {
      withDeleted: includeDeleted,
      relations,
      skip: (page - 1) * limit,
      take: limit,
    };
    if (where) {
      options.where = where;
    }
    const [data, total] = await this.repository.findAndCount(options);
    const totalPages = Math.ceil(total / limit);
    return { data, total, page, limit, totalPages };
  }

  async find(options: any): Promise<T[]> {
    return this.repository.find(options);
  }

  async bulkCreate(data: DeepPartial<T>[]): Promise<T[]> {
    const entities = this.repository.create(data);
    return this.repository.save(entities);
  }

  createQueryBuilder(alias?: string): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias);
  }
}
