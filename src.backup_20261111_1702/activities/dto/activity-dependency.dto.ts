import { IsUUID } from "class-validator";

export class ActivityDependencyDto {
  @IsUUID()
  requiredActivityId!: string;
}
