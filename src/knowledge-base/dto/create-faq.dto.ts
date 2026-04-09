import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateFaqDto {
  @ApiProperty()
  @IsString()
  question!: string;

  @ApiProperty()
  @IsString()
  answer!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
