import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/decorators/current-user.decorator";
import { CoreService } from "./core.service";
import { HeartbeatDto } from "./dto/heartbeat.dto";
import { AuditEventDto } from "./dto/audit-event.dto";

@Controller("core")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoreController {
  constructor(private readonly core: CoreService) {}

  // Cualquier usuario autenticado puede leer el estado de su licencia
  @Get("license")
  getLicense(@CurrentUser() user: AuthUser) {
    return this.core.getLicense(user.schoolId as string);
  }

  // Cualquier usuario autenticado puede enviar heartbeat
  // (en producción esto lo hace el cliente automáticamente, no el usuario)
  @Post("heartbeat")
  heartbeat(@CurrentUser() user: AuthUser, @Body() dto: HeartbeatDto) {
    return this.core.heartbeat(user.schoolId as string, dto);
  }

  // Solo school_admin puede registrar auditoría manual (eventos importantes)
  @Post("audit")
  @Roles("school_admin")
  recordAudit(
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
    @Body() dto: AuditEventDto
  ) {
    return this.core.recordAudit(user.schoolId as string, user.userId, ip, dto);
  }

  @Get("audit")
  @Roles("school_admin")
  listAudit(@CurrentUser() user: AuthUser, @Query() q: any) {
    return this.core.listAudit(user.schoolId as string, {
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      since: q.since,
      action: q.action,
    });
  }
}
