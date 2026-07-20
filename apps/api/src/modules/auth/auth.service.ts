import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { TenantService } from '../tenant/tenant.service';
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
    @Inject(forwardRef(() => TenantService))
    private tenantService: TenantService,
  ) { }

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

    const tenant = await this.tenantService.createTenant(user.id, {
      name: `${userName}'s Workspace`,
    });

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

    // Try to verify with argon2, if it fails, check if it's plain text (for backward compatibility)
    let isPasswordValid = false;
    try {
      isPasswordValid = await argon2.verify(hashedPassword, password);
    } catch {
      // If argon2 verification fails, check if password matches plain text (temporary fallback)
      if (hashedPassword === password) {
        isPasswordValid = true;
        // TODO: Rehash the password in the background
      }
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
        secret: process.env.AUTH_SECRET || 'your-secret-key',
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

    // Use longer expiration in development
    const accessTokenExpiry = process.env.NODE_ENV === 'production' ? '15m' : '7d';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiry,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.AUTH_SECRET || 'your-secret-key',
      expiresIn: '30d',
    });

    return { accessToken, refreshToken };
  }
}
