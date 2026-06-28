import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class WhatsAppWebhookVerifyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  "hub.mode"?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  "hub.verify_token"?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  "hub.challenge"?: string;
}

export class SendFollowUpDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;
}
