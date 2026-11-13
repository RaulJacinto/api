import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  userId: string;
  schoolId: string | null;
  roles: string[];
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  }
);
