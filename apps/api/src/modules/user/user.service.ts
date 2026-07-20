import { Injectable, NotFoundException } from '@nestjs/common';
import {
  getPaginationSummary,
  IPaginatedData,
} from '../../common/dto/pagination.dto';
import { DeepPartial } from 'typeorm';
import { UpdateUserDto, UserQueryDto } from './dto';
import { User } from './entities/user.entity';
import { UserRepository } from './user.repository';
import { StructuredLoggerService } from '../../common/logging/structured-logger.service';
import { LogPerformance } from '../../common/logging/decorators/log-performance.decorator';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: StructuredLoggerService,
  ) { }

  @LogPerformance({ operation: 'getUserById', category: 'user_service' })
  async getUserById(id: string): Promise<User> {
    const startTime = Date.now();
    
    try {
      const user = await this.userRepository.findOne({
        where: { id },
      });

      if (!user) {
        this.logger.warn('User not found', {
          userId: id,
          operation: 'getUserById',
          category: 'user_service',
        });
        throw new NotFoundException('User not found');
      }

      this.logger.logDatabaseQuery('SELECT user by ID', Date.now() - startTime, {
        userId: id,
        operation: 'getUserById',
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to get user by ID', error.stack, {
        userId: id,
        operation: 'getUserById',
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  async getById(id: string): Promise<User> {
    return this.getUserById(id);
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async getByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'name', 'password'] as any,
    });
  }

  async getUserByIdWithPassword(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      select: ['id', 'email', 'password'] as any,
    });
  }

  @LogPerformance({ operation: 'createUser', category: 'user_service' })
  async createUser(userData: DeepPartial<User>): Promise<User> {
    const startTime = Date.now();
    
    try {
      const user = await this.userRepository.create(userData);
      
      this.logger.logBusinessEvent('user_created', {
        userId: user.id,
        email: user.email,
        operation: 'createUser',
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error.stack, {
        email: userData.email,
        operation: 'createUser',
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  @LogPerformance({ operation: 'updateUser', category: 'user_service' })
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const startTime = Date.now();
    
    try {
      await this.userRepository.update(id, data as any);
      const updatedUser = await this.getUserById(id);
      
      this.logger.logBusinessEvent('user_updated', {
        userId: id,
        updatedFields: Object.keys(data),
        operation: 'updateUser',
        duration: Date.now() - startTime,
      });

      return updatedUser;
    } catch (error) {
      this.logger.error('Failed to update user', error.stack, {
        userId: id,
        operation: 'updateUser',
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  // Internal method for system updates that can modify sensitive fields
  async updateUserInternal(id: string, data: DeepPartial<User>): Promise<User> {
    await this.userRepository.update(id, data as any);
    return this.getUserById(id);
  }

  async deleteUser(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }


  async getUsers(query: UserQueryDto): Promise<IPaginatedData<User>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.name',
        'user.createdAt',
        'user.updatedAt',
      ]);

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // Apply pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return getPaginationSummary(data, total, { page, limit }, 'users');
  }
}
