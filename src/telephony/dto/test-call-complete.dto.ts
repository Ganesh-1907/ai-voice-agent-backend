import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsPhoneNumber, IsString, IsUUID } from "class-validator";

export class TestCallCompleteDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber("IN")
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
