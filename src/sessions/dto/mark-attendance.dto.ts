import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;

export class MarkAttendanceDto {
  @IsUUID()
  studentId!: string;

  @IsIn(ATTENDANCE_STATUSES as unknown as string[])
  status!: "present" | "absent" | "late" | "excused";

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
