import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import type { JwtUser } from "./types/jwt-user.type";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Get("me")
  me(@CurrentUser() user: JwtUser) {
    return this.authService.getProfile(user.sub);
  }

  @ApiBearerAuth()
  @Post("dev/reset-password-by-email")
  resetPasswordByEmail(@CurrentUser() user: JwtUser, @Body() dto: ResetUserPasswordDto) {
    return this.authService.resetUserPasswordByEmail(user.sub, dto);
  }
}
