import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../database/repositories/base.repository';
import { User } from './entities/user.entity';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super(userRepository);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findById(email);
  }

  async findByProviderId(
    provider: string,
    providerId: string,
  ): Promise<User | null> {
    const field = `${provider.toLowerCase()}Id`;
    const where: any = { [field]: providerId };

    return this.findOne({ where });
  }

  // async updatePassword(id: string, password: string): Promise<User | null> {
  //   return this.update(id, password );
  // }
}
