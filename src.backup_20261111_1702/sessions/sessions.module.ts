import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [AuthModule],
  controllers: [SessionsController, AttendanceController],
  providers: [SessionsService, AttendanceService],
  exports: [SessionsService, AttendanceService],
})
export class SessionsModule {}
