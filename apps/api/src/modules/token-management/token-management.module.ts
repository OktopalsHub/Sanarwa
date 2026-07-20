import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenManagementService } from './services/token-management.service';
import { TokenBalance, TokenTransaction } from '../billing/entities/token-balance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TokenBalance,
      TokenTransaction,
    ]),
  ],
  providers: [TokenManagementService],
  exports: [TokenManagementService],
})
export class TokenManagementModule {}