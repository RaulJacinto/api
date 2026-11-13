import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateCourseDto {
  @IsUUID()
  subjectId!: string;

  @IsUUID()
  gradeId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsBoolean()
  isGradable?: boolean;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
