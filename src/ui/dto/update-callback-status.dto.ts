import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class UpdateCallbackStatusDto {
  @ApiProperty({ enum: ["called", "not_called"] })
  @IsIn(["called", "not_called"])
  status!: "called" | "not_called";
}
