import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  position?: number;

}
