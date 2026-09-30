import { MiddlewareConsumer, Module, NestModule, type Provider } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { json } from "express";
import { User } from "../user/entities/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Account, Session, Verification } from "./entities";
import { AuthGuard } from "./guards/jwt-auth.guard";
import { OAuthController } from "./oauth.controller";
import { GitHubStrategy } from "./strategies/github.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";

// OAuth strategies crash passport if clientID is empty — only register when configured.
const oauthProviders: Provider[] = [
  ...(process.env.GOOGLE_CLIENT_ID ? [GoogleStrategy] : []),
  ...(process.env.GITHUB_CLIENT_ID ? [GitHubStrategy] : []),
];

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Session, Account, Verification]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_AUTH_SECRET"),
        signOptions: {
          expiresIn: (configService.get<string>("JWT_EXPIRES_IN") ||
            (configService.get("NODE_ENV") === "production" ? "15m" : "7d")) as
            | `${number}m`
            | `${number}d`
            | `${number}h`,
        },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [AuthService, AuthGuard, ...oauthProviders],
  exports: [AuthService, AuthGuard, JwtModule, PassportModule],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(json()).forRoutes(AuthController, OAuthController);
  }
}
