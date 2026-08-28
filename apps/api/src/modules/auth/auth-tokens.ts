import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { User } from "../user/entities/user.entity";

export function generateAuthTokens(
  user: User,
  jwtService: JwtService,
  configService: ConfigService,
): { accessToken: string; refreshToken: string } {
  const payload = { sub: user.id, email: user.email };
  const refreshSecret = configService.getOrThrow<string>("JWT_REFRESH_SECRET");
  const accessTokenExpiry =
    configService.get("JWT_EXPIRES_IN") ||
    (configService.get("NODE_ENV") === "production" ? "15m" : "7d");
  const refreshTokenExpiry = configService.get("JWT_REFRESH_EXPIRES_IN") || "30d";

  return {
    accessToken: jwtService.sign(payload, { expiresIn: accessTokenExpiry }),
    refreshToken: jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshTokenExpiry,
    }),
  };
}
