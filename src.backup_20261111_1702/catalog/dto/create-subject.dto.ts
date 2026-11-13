import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateSubjectDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: "slug debe ser lowercase, números y guiones",
  })
  slug!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;
}
