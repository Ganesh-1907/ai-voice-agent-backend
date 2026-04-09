import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional, IsPhoneNumber, IsString } from "class-validator";

export class CreateBusinessDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsPhoneNumber("IN")
  businessPhoneNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber("IN")
  virtualPhoneNumber?: string;

  @ApiPropertyOptional({ enum: ["starter", "growth", "pro"] })
  @IsOptional()
  @IsEnum(["starter", "growth", "pro"])
  planCode?: "starter" | "growth" | "pro";

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
