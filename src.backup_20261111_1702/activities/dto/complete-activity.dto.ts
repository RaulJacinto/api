import { IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class CompleteActivityDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;
}
