import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ProcessAgentTurnDto {
  @ApiProperty()
  @IsString()
  customerText!: string;
}
