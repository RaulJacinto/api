import { SetMetadata } from "@nestjs/common";

export type UserRole =
  | "super_admin"
  | "instructor"
  | "school_admin"
  | "teacher"
  | "student"
  | "parent";

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
