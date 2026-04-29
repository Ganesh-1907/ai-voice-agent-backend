import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

export class CreateProductImageDto {
  @ApiProperty()
  @IsString()
  @Matches(/^(https?:\/\/|data:image\/)/i, {
    message: "imageUrl must be an http(s) URL or a data:image payload",
  })
  imageUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
