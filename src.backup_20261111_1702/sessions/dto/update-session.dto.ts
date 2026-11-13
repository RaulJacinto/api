import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export const SESSION_STATUSES = ["scheduled", "live", "ended", "cancelled"] as const;

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsIn(["in_person", "virtual", "hybrid"])
  mode?: "in_person" | "virtual" | "hybrid";

  @IsOptional()
  @IsIn(SESSION_STATUSES as unknown as string[])
  status?: "scheduled" | "live" | "ended" | "cancelled";

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
