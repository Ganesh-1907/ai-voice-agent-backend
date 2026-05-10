import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class CreateBusinessUserDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: ["owner", "admin", "staff"] })
  @IsOptional()
  @IsEnum(["owner", "admin", "staff"])
  role?: "owner" | "admin" | "staff";
}
