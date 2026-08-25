import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, StrategyOptions } from "passport-github2";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(private configService: ConfigService) {
    const options: StrategyOptions = {
      clientID: configService.get("GITHUB_CLIENT_ID") || "",
      clientSecret: configService.get("GITHUB_CLIENT_SECRET") || "",
      callbackURL: configService.get("GITHUB_CALLBACK_URL") || "",
      scope: ["user:email"],
    };
    super(options);
  }

  async validate(accessToken: string, refreshToken: string, profile: any): Promise<any> {
    const { id, username, displayName, emails, photos } = profile;

    return {
      id,
      email: emails?.[0]?.value,
      name: displayName || username,
      picture: photos?.[0]?.value,
      provider: "github",
      accessToken,
      refreshToken,
    };
  }
}
