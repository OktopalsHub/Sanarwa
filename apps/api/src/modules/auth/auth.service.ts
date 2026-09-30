import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { UserRegisteredEvent } from '../../common/events/user.event';
import { User } from '../user/entities/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Account } from './entities/account.entity';
import { Session } from './entities/session.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    console.log('Registering:', registerDto);

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Provide default name if not provided
    const userName = name || `User ${email.split('@')[0]}`;

    const hashedPassword = await argon2.hash(password);

    const user = this.userRepository.create({
      id: randomUUID(),
      email,
      password: hashedPassword,
      emailVerified: false,
      name: userName,
    });

    await this.userRepository.save(user);

    // Create credential account
    const account = this.accountRepository.create({
      id: randomUUID(),
      userId: user.id,
      providerId: 'credential',
      password: hashedPassword,
    });

    await this.accountRepository.save(account);

    const tokens = this.generateTokens(user);

    // Create session record
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = this.sessionRepository.create({
      id: randomUUID(),
      userId: user.id,
      token: sessionToken,
      expiresAt,
      ipAddress: null, // Will be set by middleware if needed
      userAgent: null, // Will be set by middleware if needed
    });

    await this.sessionRepository.save(session);

    const [tenant] = await this.eventEmitter.emitAsync(
      'user.registered',
      new UserRegisteredEvent(user.id, `${userName}'s Workspace`),
    );

    if (!tenant) {
      throw new BadRequestException('Failed to create workspace');
    }

    const tenantSlug = tenant.subdomain || tenant.slug || tenant.id;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        slug: tenantSlug,
      },
      tenantSlug,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let hashedPassword: string | null = null;

    // Check account table first
    const account = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: 'credential' },
    });
    if (account?.password) {
      hashedPassword = account.password;
    } else if (user.password) {
      // Check user table (for custom auth)
      hashedPassword = user.password;
    }

    if (!hashedPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await argon2.verify(hashedPassword, password);
    } catch {
      // Invalid hash format — reject login (do not fall back to plaintext compare)
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user);

    // Create session record
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = this.sessionRepository.create({
      id: randomUUID(),
      userId: user.id,
      token: sessionToken,
      expiresAt,
      ipAddress: null, // Will be set by middleware if needed
      userAgent: null, // Will be set by middleware if needed
    });

    await this.sessionRepository.save(session);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ...tokens,
    };
  }

  async oauthCallback(provider: string, profile: any) {
    let user = await this.userRepository.findOne({
      where: { email: profile.email },
    });

    if (!user) {
      user = this.userRepository.create({
        id: randomUUID(),
        email: profile.email,
        name: profile.name || profile.displayName,
        image: profile.picture || profile.photos?.[0]?.value,
        emailVerified: true,
      });
      await this.userRepository.save(user);
    }

    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ...tokens,
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.password) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await argon2.verify(user.password, currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHashedPassword = await argon2.hash(newPassword);
    user.password = newHashedPassword;
    await this.userRepository.save(user);

    // Update account password
    const account = await this.accountRepository.findOne({
      where: { userId: userId, providerId: 'credential' },
    });
    if (account) {
      account.password = newHashedPassword;
      await this.accountRepository.save(account);
    }

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'If email exists, reset link will be sent' };
    }

    // TODO: Generate reset token and send email
    // This should be implemented with a reset token stored in DB with expiry

    return { message: 'If email exists, reset link will be sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // TODO: Verify reset token and get user
    // This should validate the token and extract user ID

    throw new BadRequestException('Invalid or expired reset token');
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = this.generateTokens(user);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // Invalidate all sessions for this user
    await this.sessionRepository.delete({ userId });
    return { message: 'Logged out successfully' };
  }

  async getSession(accessToken: string) {
    try {
      const payload = this.jwtService.verify(accessToken);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        return null;
      }
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    } catch {
      return null;
    }
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const accessTokenExpiry =
      this.configService.get('JWT_EXPIRES_IN') ||
      (this.configService.get('NODE_ENV') === 'production' ? '15m' : '7d');

    const refreshTokenExpiry =
      this.configService.get('JWT_REFRESH_EXPIRES_IN') || '30d';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiry,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshTokenExpiry,
    });

    return { accessToken, refreshToken };
  }
}
