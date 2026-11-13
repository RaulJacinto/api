import {
  Body,
  Controller,
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
import { ActivitiesService } from "./activities.service";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { ActivityDependencyDto } from "./dto/activity-dependency.dto";
import { CompleteActivityDto } from "./dto/complete-activity.dto";
import { UpdateProgressDto } from "./dto/update-progress.dto";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Post("courses/:courseId/activities")
  @Roles("school_admin")
  create(
    @CurrentUser() user: AuthUser,
    @Param("courseId") courseId: string,
    @Body() dto: CreateActivityDto
  ) {
    return this.activities.create(user.schoolId as string, courseId, dto);
  }

  @Patch("activities/:id")
  @Roles("school_admin")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateActivityDto
  ) {
    return this.activities.update(user.schoolId as string, id, dto);
  }

  @Get("activities/:id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.activities.getForViewer(
      user.schoolId as string,
      id,
      user.userId,
      user.roles.includes("student")
    );
  }

  @Post("activities/:id/complete")
  @Roles("student")
  complete(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CompleteActivityDto
  ) {
    return this.activities.complete(user.schoolId as string, id, user.userId, dto);
  }

 @Patch("activities/:id/progress")
  @Roles("student")
  progress(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateProgressDto
  ) {
    return this.activities.updateProgress(
      user.schoolId as string,
      id,
      user.userId,
      dto
    );
  }

  @Post("activities/:id/dependencies")
  @Roles("school_admin")
  addDependency(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ActivityDependencyDto
  ) {
    return this.activities.addDependency(user.schoolId as string, id, dto.requiredActivityId);
  }
}
