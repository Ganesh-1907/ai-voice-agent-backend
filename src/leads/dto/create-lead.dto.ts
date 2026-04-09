import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsPhoneNumber, IsString } from "class-validator";

export class CreateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty()
  @IsPhoneNumber("IN")
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
