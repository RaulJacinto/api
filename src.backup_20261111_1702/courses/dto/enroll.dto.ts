import { ArrayNotEmpty, IsArray, IsUUID } from "class-validator";

export class EnrollDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  studentIds!: string[];
}
