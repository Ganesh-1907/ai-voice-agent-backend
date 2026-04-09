import { ApiProperty } from "@nestjs/swagger";
import { IsPhoneNumber, IsString } from "class-validator";

export class CompleteCallDto {
  @ApiProperty()
  @IsString()
  transcript!: string;

  @ApiProperty()
  @IsPhoneNumber("IN")
  customerPhone!: string;
}
