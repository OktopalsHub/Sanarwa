import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Response,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { ChangePasswordDto, ChangePasswordResponseDto } from "./dto/change-password.dto";
import { ForgotPasswordDto, ForgotPasswordResponseDto } from "./dto/forgot-password.dto";
import { LoginDto, LoginResponseDto } from "./dto/login.dto";
import { RefreshTokenDto, RefreshTokenResponseDto } from "./dto/refresh-token.dto";
import { RegisterDto, RegisterResponseDto } from "./dto/register.dto";
import { ResetPasswordDto, ResetPasswordResponseDto } from "./dto/reset-password.dto";
import { AuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get("profile")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "User profile retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized - Invalid or missing token" })
  async getProfile(@Request() req: { user: { sub: string } }) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post("register")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register new user" })
  @ApiResponse({
    status: 201,
    description: "User successfully registered",
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Invalid input data",
  })
  @ApiResponse({
    status: 409,
    description: "Conflict - Email already registered",
  })
  async register(@Body() registerDto: RegisterDto, @Response() res: any) {
    const result = await this.authService.register(registerDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json(result);
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({
    status: 200,
    description: "User successfully logged in",
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Invalid input data",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid credentials",
  })
  async login(@Body() loginDto: LoginDto, @Response() res: any) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json(result);
  }

  @Post("change-password")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change password" })
  @ApiResponse({
    status: 200,
    description: "Password successfully changed",
    type: ChangePasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Invalid input data",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing token",
  })
  async changePassword(@Request() req: any, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, changePasswordDto);
  }

  @Post("forgot-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request password reset" })
  @ApiResponse({
    status: 200,
    description: "Password reset email sent",
    type: ForgotPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Invalid email format",
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("reset-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password with token" })
  @ApiResponse({
    status: 200,
    description: "Password successfully reset",
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Invalid or expired token",
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post("refresh-token")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({
    status: 200,
    description: "Tokens successfully refreshed",
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Invalid refresh token",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Expired or invalid refresh token",
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Response() res: any) {
    const result = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json(result);
  }

  @Post("get-session")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get current session" })
  @ApiResponse({
    status: 200,
    description: "Session information retrieved",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - No valid session found",
  })
  async getSession(@Request() req: any) {
    const accessToken = req.cookies?.accessToken;
    if (!accessToken) {
      return null;
    }
    return this.authService.getSession(accessToken);
  }

  @Post("logout")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout user" })
  @ApiResponse({
    status: 200,
    description: "User successfully logged out",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing token",
  })
  async logout(@Request() req: any, @Response() res: any) {
    const result = await this.authService.logout(req.user.sub);
    this.clearAuthCookies(res);
    return res.json(result);
  }

  private setAuthCookies(res: any, accessToken: string, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
    };

    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearAuthCookies(res: any) {
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });
  }
}
