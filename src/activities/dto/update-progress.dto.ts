import { IsInt, IsOptional, Min } from "class-validator";

export class UpdateProgressDto {
  /** Segundos donde quedó el alumno (video/juego). */
  @IsOptional()
  @IsInt()
  @Min(0)
  resumePositionSec?: number;
}
