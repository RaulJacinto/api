import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CoreController } from "./core.controller";
import { CoreService } from "./core.service";

@Module({
  imports: [AuthModule],
  controllers: [CoreController],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
