import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, ValidateNested } from "class-validator";
import { MarkAttendanceDto } from "./mark-attendance.dto";

export class BulkAttendanceDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceDto)
  entries!: MarkAttendanceDto[];
}
