import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import { UserRegisteredEvent } from "../../common/events/user.event";
import { User } from "../user/entities/user.entity";
import { toAuthProfile } from "./auth-profile";
import { AuthPasswordService } from "./auth-password.service";
import { AuthSessionService } from "./auth-session.service";
import { generateAuthTokens } from "./auth-tokens";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { Account } from "./entities/account.entity";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private sessionService: AuthSessionService,
    private passwordService: AuthPasswordService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException("Email already registered");
    }

    const userName = name || `User ${email.split("@")[0]}`;
    const hashedPassword = await argon2.hash(password);

    const user = this.userRepository.create({
      id: randomUUID(),
      email,
      password: hashedPassword,
      emailVerified: false,
      name: userName,
    });
    await this.userRepository.save(user);

    await this.accountRepository.save(
      this.accountRepository.create({
        id: randomUUID(),
        userId: user.id,
        providerId: "credential",
        password: hashedPassword,
      }),
    );

    const tokens = generateAuthTokens(user, this.jwtService, this.configService);
    await this.sessionService.createSession(user.id);

    const [tenant] = await this.eventEmitter.emitAsync(
      "user.registered",
      new UserRegisteredEvent(user.id, `${userName}'s Workspace`),
    );
    if (!tenant) {
      throw new BadRequestException("Failed to create workspace");
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
      throw new UnauthorizedException("Invalid credentials");
    }

    const account = await this.accountRepository.findOne({
      where: { userId: user.id, providerId: "credential" },
    });
    const hashedPassword = account?.password || user.password;
    if (!hashedPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await argon2.verify(hashedPassword, password);
    } catch {
      // Invalid hash format
    }
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = generateAuthTokens(user, this.jwtService, this.configService);
    await this.sessionService.createSession(user.id);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      ...tokens,
    };
  }

  async oauthCallback(_provider: string, profile: Record<string, unknown>) {
    let user = await this.userRepository.findOne({
      where: { email: profile.email as string },
    });

    if (!user) {
      user = this.userRepository.create({
        id: randomUUID(),
        email: profile.email as string,
        name: (profile.name || profile.displayName) as string,
        image: (profile.picture || (profile.photos as { value: string }[])?.[0]?.value) as string,
        emailVerified: true,
      });
      await this.userRepository.save(user);
    }

    const tokens = generateAuthTokens(user, this.jwtService, this.configService);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      ...tokens,
    };
  }

  changePassword(userId: string, dto: Parameters<AuthPasswordService["changePassword"]>[1]) {
    return this.passwordService.changePassword(userId, dto);
  }

  forgotPassword(dto: Parameters<AuthPasswordService["forgotPassword"]>[0]) {
    return this.passwordService.forgotPassword(dto);
  }

  resetPassword(dto: Parameters<AuthPasswordService["resetPassword"]>[0]) {
    return this.passwordService.resetPassword(dto);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
      const user = await this.userRepository.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException("User not found");
      }
      return generateAuthTokens(user, this.jwtService, this.configService);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  logout(userId: string) {
    return this.sessionService.logout(userId);
  }

  async getSession(accessToken: string) {
    try {
      const payload = this.jwtService.verify(accessToken);
      const user = await this.userRepository.findOne({ where: { id: payload.sub } });
      if (!user) {
        return null;
      }
      return { user: { id: user.id, email: user.email, name: user.name } };
    } catch {
      return null;
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return toAuthProfile(user);
  }
}
