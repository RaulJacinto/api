import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  health() {
    return { ok: true, service: "lms-edudin-api", ts: new Date().toISOString() };
  }
}
