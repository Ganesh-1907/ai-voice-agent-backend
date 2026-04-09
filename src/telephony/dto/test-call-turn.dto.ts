import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, MinLength } from "class-validator";

export class TestCallTurnDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  businessId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  customerText!: string;
}
