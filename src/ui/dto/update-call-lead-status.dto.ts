import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class UpdateCallLeadStatusDto {
  @ApiProperty({ enum: ["read", "unread"] })
  @IsIn(["read", "unread"])
  status!: "read" | "unread";
}
