import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ProcessCallTurnDto {
  @ApiProperty()
  @IsString()
  customerText!: string;
}
