import { MiddlewareConsumer, Module, NestModule, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { json } from 'express';
import { User } from '../user/entities/user.entity';
import { TenantModule } from '../tenant/tenant.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Account, Session, Verification } from './entities';
import { AuthGuard } from './guards/jwt-auth.guard';
import { OAuthController } from './oauth.controller';
import { GitHubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Session, Account, Verification]),
    PassportModule,
    forwardRef(() => TenantModule),
    JwtModule.register({
      secret: process.env.AUTH_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: process.env.NODE_ENV === 'production' ? '15m' : '7d',
      },
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    AuthGuard,
    GoogleStrategy,
    GitHubStrategy,
  ],
  exports: [AuthService, AuthGuard, JwtModule, PassportModule]
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(json()).forRoutes(AuthController, OAuthController);
  }
}
