import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateEntryDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000)
  maxScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
