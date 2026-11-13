import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export const SESSION_MODES = ["in_person", "virtual", "hybrid"] as const;

export class CreateSessionDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsUUID()
  teacherId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsIn(SESSION_MODES as unknown as string[])
  mode!: "in_person" | "virtual" | "hybrid";

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  virtualUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
