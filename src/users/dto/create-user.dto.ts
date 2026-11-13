import { IsEmail, IsIn, IsOptional, IsArray, IsString, MinLength } from "class-validator";

export const CREATABLE_ROLES = ["teacher", "student", "parent"] as const;
export type CreatableRole = (typeof CREATABLE_ROLES)[number];

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  displayName!: string;

  @IsIn(CREATABLE_ROLES as unknown as string[])
  role!: CreatableRole;

  /** Solo para parent: alumnos a los que vincular */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];
}
