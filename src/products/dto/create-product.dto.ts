import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(220)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ["car", "bike", "scooter", "fridge", "ac", "washing_machine", "tv", "mobile", "furniture", "other"] })
  @IsEnum(["car", "bike", "scooter", "fridge", "ac", "washing_machine", "tv", "mobile", "furniture", "other"])
  category!: "car" | "bike" | "scooter" | "fridge" | "ac" | "washing_machine" | "tv" | "mobile" | "furniture" | "other";

  @ApiPropertyOptional({ enum: ["new", "used", "refurbished"] })
  @IsOptional()
  @IsEnum(["new", "used", "refurbished"])
  condition?: "new" | "used" | "refurbished";

  @ApiPropertyOptional({ enum: ["draft", "available", "reserved", "sold", "inactive"] })
  @IsOptional()
  @IsEnum(["draft", "available", "reserved", "sold", "inactive"])
  status?: "draft" | "available" | "reserved" | "sold" | "inactive";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiProperty()
  @IsNumber()
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discountPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  manufactureYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  registrationYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  purchaseYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  mileageKm?: number;

  @ApiPropertyOptional({ enum: ["petrol", "diesel", "electric", "hybrid", "cng", "lpg", "other"] })
  @IsOptional()
  @IsEnum(["petrol", "diesel", "electric", "hybrid", "cng", "lpg", "other"])
  fuelType?: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | "lpg" | "other";

  @ApiPropertyOptional({ enum: ["manual", "automatic", "semi_automatic", "other"] })
  @IsOptional()
  @IsEnum(["manual", "automatic", "semi_automatic", "other"])
  transmission?: "manual" | "automatic" | "semi_automatic" | "other";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionNotes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  searchTags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  specifications?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
