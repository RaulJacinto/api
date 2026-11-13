import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DbModule } from "./db/db.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CoursesModule } from "./courses/courses.module";
import { ActivitiesModule } from "./activities/activities.module";
import { SessionsModule } from "./sessions/sessions.module";
import { CoreModule } from "./core/core.module";
import { GradebookModule } from "./gradebook/gradebook.module";
import { SchoolsModule } from "./schools/schools.module";

@Module({
  imports: [
    DbModule,
    RedisModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    CoursesModule,
    ActivitiesModule,
    SessionsModule,
    CoreModule,
    GradebookModule,
    SchoolsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
