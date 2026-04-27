import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl } from "class-validator";

export class ConnectExotelAppCallDto {
  @ApiProperty({
    description:
      "Customer number Exotel should call first. Accepts +91XXXXXXXXXX, 0XXXXXXXXXX, or plain 10-digit Indian mobile numbers.",
  })
  @IsString()
  customerNumber!: string;

  @ApiPropertyOptional({
    description: "Full Exotel flow/app URL. Defaults to EXOTEL_APP_URL when configured.",
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  appUrl?: string;

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
    description: "Optional CustomField echoed back by Exotel Passthru/flow callbacks.",
  })
  @IsOptional()
  @IsString()
  customField?: string;
}
