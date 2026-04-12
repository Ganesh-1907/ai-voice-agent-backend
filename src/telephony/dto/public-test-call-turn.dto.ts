import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class PublicTestCallTurnDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  customerText!: string;
}
