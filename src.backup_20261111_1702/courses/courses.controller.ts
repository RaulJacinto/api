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
import { CoursesService } from "./courses.service";
import { CreateCourseDto } from "./dto/create-course.dto";
import { EnrollDto } from "./dto/enroll.dto";
import { DependencyDto } from "./dto/dependency.dto";

@Controller("courses")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Post()
  @Roles("school_admin")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCourseDto) {
    return this.courses.create(user.schoolId as string, user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    const isStudent = user.roles.includes("student");
    return this.courses.list(
      user.schoolId as string,
      isStudent ? user.userId : undefined
    );
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const isStudent = user.roles.includes("student");
    return this.courses.getById(
      user.schoolId as string,
      id,
      isStudent ? user.userId : undefined
    );
  }

  @Post(":id/enroll")
  @Roles("school_admin")
  enroll(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: EnrollDto
  ) {
    return this.courses.enroll(user.schoolId as string, id, dto);
  }

  @Post(":id/dependencies")
  @Roles("school_admin")
  addDependency(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: DependencyDto
  ) {
    return this.courses.addDependency(user.schoolId as string, id, dto.requiredCourseId);
  }
}
