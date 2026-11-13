import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GradebookController } from "./gradebook.controller";
import { GradebookService } from "./gradebook.service";

@Module({
  imports: [AuthModule],
  controllers: [GradebookController],
  providers: [GradebookService],
  exports: [GradebookService],
})
export class GradebookModule {}
