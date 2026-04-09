import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class StartTestCallDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  businessId!: string;
}
