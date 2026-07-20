import {
  Controller,
  Get,
  Param,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { OAuthGuard } from './guards/google-auth.guard';

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
  constructor(private authService: AuthService) { }

  @Get(':provider')
  @UseGuards(OAuthGuard)
  @ApiOperation({ summary: 'OAuth provider login' })
  @ApiResponse({ status: 302, description: 'Redirects to OAuth provider' })
  async oauthAuth(@Param('provider') provider: string) {
    // Passport handles the redirect
  }

  @Get(':provider/callback')
  @UseGuards(OAuthGuard)
  @ApiOperation({ summary: 'OAuth provider callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async oauthCallback(
    @Param('provider') provider: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const result = await this.authService.oauthCallback(provider, req.user);
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;
    res.redirect(redirectUrl);
  }
}
