import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ExotelCallWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  CallSid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  From?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  To?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  Status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  OriginalBusinessNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  OriginalCalledNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  CalledNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  DialWhomNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  CallStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  RecordingUrl?: string;

  [key: string]: unknown;
}
