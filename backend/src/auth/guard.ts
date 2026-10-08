import { coded } from "../common/errors";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { User, Role } from "../database/entities";
import { AuthService } from "./auth.service";
export interface AuthRequest extends Request {
  user: User;
}
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const user = await this.auth.resolve(req.cookies?.reservacr_session);
    if (!user) throw new UnauthorizedException(coded("AUTH_UNAUTHORIZED", "Inicia sesión para continuar."));
    req.user = user;
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(user.role))
      throw new ForbiddenException(coded("AUTH_FORBIDDEN", "No tienes permiso para esta acción."));
    return true;
  }
}
