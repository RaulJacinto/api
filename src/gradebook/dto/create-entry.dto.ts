import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from "class-validator";

export class CreateEntryDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  courseId!: string;

  @IsString()
  @MaxLength(32)
  period!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score!: number;

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
