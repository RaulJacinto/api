import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/decorators/current-user.decorator";
import { SchoolsService } from "./schools.service";
import { UpdateBrandingDto } from "./dto/update-branding.dto";

@Controller("schools")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  // Cualquier usuario autenticado lee la info + branding de su escuela
  @Get("me")
  getMe(@CurrentUser() user: AuthUser) {
    return this.schools.getMe(user.schoolId as string);
  }

  // Solo admin puede personalizar
  @Patch("me/branding")
  @Roles("school_admin")
  updateBranding(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBrandingDto
  ) {
    return this.schools.updateBranding(user.schoolId as string, dto);
  }
}
