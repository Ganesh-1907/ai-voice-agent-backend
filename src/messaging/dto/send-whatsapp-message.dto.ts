import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsPhoneNumber, IsString, IsIn } from "class-validator";

export class SendWhatsAppMessageDto {
  @ApiProperty()
  @IsPhoneNumber("IN")
  recipient!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["text", "interactive", "image"])
  messageType?: "text" | "interactive" | "image";
}
