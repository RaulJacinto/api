import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CatalogService } from "./catalog.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";

@Controller("catalog")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // Lectura: cualquier usuario autenticado (admin, teacher, student, parent)
  @Get("levels")
  listLevels() {
    return this.catalog.listLevels();
  }

  @Get("grades")
  listGrades(@Query("levelId") levelId?: string) {
    return this.catalog.listGrades(levelId);
  }

  @Get("subjects")
  listSubjects() {
    return this.catalog.listSubjects();
  }

  // Escritura: solo school_admin
  @Post("subjects")
  @Roles("school_admin")
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.catalog.createSubject(dto);
  }
}

