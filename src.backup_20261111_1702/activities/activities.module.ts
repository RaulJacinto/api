import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CoursesModule } from "../courses/courses.module";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesService } from "./activities.service";

@Module({
  imports: [AuthModule, CoursesModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
