import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import type { JwtUser } from "./types/jwt-user.type";

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(JwtService) private readonly jwtService: JwtService,
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
