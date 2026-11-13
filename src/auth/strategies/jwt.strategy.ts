import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthUser } from "../decorators/current-user.decorator";

export interface JwtPayload {
  sub: string;
  schoolId: string | null;
  email: string;
  roles: string[];
  type: "access" | "refresh";
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Token type inválido");
    }
    return {
      userId: payload.sub,
      schoolId: payload.schoolId,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
