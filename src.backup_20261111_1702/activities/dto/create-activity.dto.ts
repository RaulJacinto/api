import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export const ACTIVITY_TYPES = [
  "video",
  "game_standalone",
  "game_after_video",
  "quiz",
  "reading",
  "family",
  "group",
  "interactive",
  "external",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export class CreateActivityDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsIn(ACTIVITY_TYPES as unknown as string[])
  type!: ActivityType;

  @IsOptional()
  @IsString()
  description?: string;

  /** Config específica: url del video, preguntas del quiz, etc. */
  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isGradable?: boolean;

  @IsOptional()
  @IsInt()
  durationSec?: number;
}
