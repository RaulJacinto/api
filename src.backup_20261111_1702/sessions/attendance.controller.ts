import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/decorators/current-user.decorator";
import { AttendanceService } from "./attendance.service";
import { BulkAttendanceDto } from "./dto/bulk-attendance.dto";

@Controller("sessions/:sessionId/attendance")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post()
  @Roles("school_admin", "teacher")
  markBulk(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: BulkAttendanceDto
  ) {
    return this.attendance.markBulk(user.schoolId as string, sessionId, user.userId, dto);
  }

  @Get()
  @Roles("school_admin", "teacher")
  list(@CurrentUser() user: AuthUser, @Param("sessionId") sessionId: string) {
    return this.attendance.list(user.schoolId as string, sessionId);
  }
}
