import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/decorators/current-user.decorator";
import { SessionsService } from "./sessions.service";
import { CreateSessionDto } from "./dto/create-session.dto";
import { UpdateSessionDto } from "./dto/update-session.dto";

@Controller("sessions")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @Roles("school_admin", "teacher")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user.schoolId as string, user.userId, dto);
  }

  @Patch(":id")
  @Roles("school_admin", "teacher")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateSessionDto
  ) {
    return this.sessions.update(user.schoolId as string, id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: any) {
    if (user.roles.includes("student")) {
      return this.sessions.listForStudent(user.userId, user.schoolId as string);
    }
    return this.sessions.listForAdmin(user.schoolId as string, {
      courseId: q.courseId,
      from: q.from,
      to: q.to,
      status: q.status,
    });
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.sessions.getDetail(user.schoolId as string, id);
  }
}
