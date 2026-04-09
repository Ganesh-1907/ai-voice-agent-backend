import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateCallTranscriptDto {
  @ApiProperty()
  @IsString()
  transcript!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}
