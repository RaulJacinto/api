import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/decorators/current-user.decorator";
import { GradebookService } from "./gradebook.service";
import { CreateEntryDto } from "./dto/create-entry.dto";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
//import { GradebookController } from "./gradebook.controller";

@Controller("gradebook")
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradebookController {
  constructor(private readonly gradebook: GradebookService) {}

  // ---------- Entradas ----------
  @Post()
  @Roles("school_admin", "teacher")
  upsert(@CurrentUser() user: AuthUser, @Body() dto: CreateEntryDto) {
    return this.gradebook.upsertEntry(user.schoolId as string, user.userId, dto);
  }

  @Patch(":id")
  @Roles("school_admin", "teacher")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateEntryDto
  ) {
    return this.gradebook.updateById(user.schoolId as string, id, dto, user.userId);
  }

  @Delete(":id")
  @Roles("school_admin", "teacher")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.gradebook.deleteById(user.schoolId as string, id);
  }

  // ---------- Libro del curso ----------
  @Get("course/:courseId")
  @Roles("school_admin", "teacher")
  courseSheet(@CurrentUser() user: AuthUser, @Param("courseId") courseId: string) {
    return this.gradebook.courseSheet(user.schoolId as string, courseId);
  }

  // ---------- Boletín del alumno ----------
  @Get("student/:studentId")
  studentReport(
    @CurrentUser() user: AuthUser,
    @Param("studentId") studentId: string
  ) {
    return this.gradebook.studentReportCard(
      user.schoolId as string,
      studentId,
      user.userId,
      user.roles
    );
  }

  // ---------- Certificados ----------
  @Post("certificate/:courseId/:studentId")
  @Roles("school_admin", "teacher")
  issueCertificate(
    @CurrentUser() user: AuthUser,
    @Param("courseId") courseId: string,
    @Param("studentId") studentId: string
  ) {
    return this.gradebook.issueCertificate(user.schoolId as string, courseId, studentId);
  }

  @Get("certificate/:courseId/:studentId")
  getCertificate(
    @CurrentUser() user: AuthUser,
    @Param("courseId") courseId: string,
    @Param("studentId") studentId: string
  ) {
    return this.gradebook.getCertificate(user.schoolId as string, courseId, studentId);
  }
}



@Module({
  imports: [AuthModule],
  controllers: [GradebookController],
  providers: [GradebookService],
  exports: [GradebookService],
})
export class GradebookModule {}

