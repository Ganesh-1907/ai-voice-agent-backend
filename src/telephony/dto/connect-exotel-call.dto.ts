import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUrl } from "class-validator";

export class ConnectExotelCallDto {
  @ApiProperty({
    description:
      "Phone number Exotel should call first. Accepts +91XXXXXXXXXX, 0XXXXXXXXXX, or plain 10-digit Indian mobile numbers.",
  })
  @IsString()
  fromNumber!: string;

  @ApiProperty({
    description:
      "Phone number Exotel should connect after fromNumber answers. Accepts +91XXXXXXXXXX, 0XXXXXXXXXX, or plain 10-digit Indian mobile numbers.",
  })
  @IsString()
  toNumber!: string;

  @ApiPropertyOptional({
    description: "Override Exotel CallerId. Defaults to EXOTEL_CALLER_ID or EXOTEL_VIRTUAL_NUMBER.",
  })
  @IsOptional()
  @IsString()
  callerId?: string;

  @ApiPropertyOptional({
    description: "Optional callback URL for Exotel call status events.",
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  statusCallbackUrl?: string;

  @ApiPropertyOptional({
    description: "Ask Exotel to record the call.",
  })
  @IsOptional()
  @IsBoolean()
  record?: boolean;
}
