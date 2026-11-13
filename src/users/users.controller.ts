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
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("school_admin")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.schoolId as string, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.users.list(
      user.schoolId as string,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20
    );
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.users.getById(user.schoolId as string, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto
  ) {
    return this.users.update(user.schoolId as string, id, dto);
  }

  @Post(":id/link-parent")
  linkParent(
    @CurrentUser() user: AuthUser,
    @Param("id") parentId: string,
    @Body() body: { studentId: string }
  ) {
    return this.users.linkParent(user.schoolId as string, parentId, body.studentId);
  }
}
