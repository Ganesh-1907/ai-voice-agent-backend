import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ["pending", "accepted", "rejected"] })
  @IsIn(["pending", "accepted", "rejected"])
  status!: "pending" | "accepted" | "rejected";
}
