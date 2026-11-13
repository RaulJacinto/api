import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";

export class RegisterSchoolAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  displayName!: string;

  @IsString()
  schoolName!: string;

  @IsString()
  schoolSlug!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
