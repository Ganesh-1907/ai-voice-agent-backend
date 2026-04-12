import { ApiProperty } from "@nestjs/swagger";
import { IsPhoneNumber } from "class-validator";

export class StartPublicTestCallDto {
  @ApiProperty()
  @IsPhoneNumber("IN")
  fromNumber!: string;

  @ApiProperty()
  @IsPhoneNumber("IN")
  toNumber!: string;
}
