import { IsUUID } from "class-validator";

export class DependencyDto {
  @IsUUID()
  requiredCourseId!: string;
}
