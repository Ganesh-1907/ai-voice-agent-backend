import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { RegisterDto } from "./dto/register.dto";
import type { JwtUser } from "./types/jwt-user.type";

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    return this.issueToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findByIdOrFail(userId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  async resetUserPasswordByEmail(requesterUserId: string, dto: ResetUserPasswordDto) {
    const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development";
    if (nodeEnv === "production") {
      throw new ForbiddenException("This endpoint is disabled in production");
    }

    const requester = await this.usersService.findByIdOrFail(requesterUserId);
    if (requester.role !== "super_admin" && requester.role !== "owner" && requester.role !== "admin") {
      throw new ForbiddenException("Only owner/admin users can reset passwords");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const updated = await this.usersService.resetPasswordByEmail(dto.email, passwordHash);

    return {
      updated: true,
      userId: updated.id,
      email: updated.email,
      updatedAt: updated.updatedAt,
    };
  }

  private issueToken(payload: JwtUser) {
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      },
    };
  }
}
