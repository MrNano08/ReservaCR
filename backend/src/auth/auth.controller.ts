import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response, Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { AuthService, safeUser } from "./auth.service";
import { AuthGuard, AuthRequest } from "./guard";
import { parse, email, fullName, registrationPhone, securePassword } from "../common/validation";
import { config } from "../common/config";
const cookie = {
  httpOnly: true,
  secure: config.COOKIE_SECURE === "true",
  sameSite: "lax" as const,
  path: "/api",
};
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post("register")
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const d = parse(
      z
        .object({
          name: fullName,
          email,
          password: securePassword,
          phone: registrationPhone.default(""),
          role: z.enum(["CLIENT", "BUSINESS"]).default("CLIENT"),
        })
        .strict(),
      body,
    );
    const result = await this.auth.register(d);
    res.cookie("reservacr_session", result.token, {
      ...cookie,
      maxAge: 7 * 86400000,
    });
    return result.user;
  }
  @Post("forgot-password")
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgot(@Body() body: unknown) {
    const d = parse(z.object({ email, language: z.enum(["es", "en"]).optional() }).strict(), body);
    return this.auth.requestPasswordReset(d.email, d.language);
  }
  @Post("reset-password")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  reset(@Body() body: unknown) {
    const d = parse(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: securePassword }).strict(), body);
    return this.auth.resetPassword(d.token, d.password);
  }
  @Post("login")
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const d = parse(
      z.object({ email, password: z.string().min(1).max(72) }).strict(),
      body,
    );
    const result = await this.auth.login(d.email, d.password);
    res.cookie("reservacr_session", result.token, {
      ...cookie,
      maxAge: 7 * 86400000,
    });
    return result.user;
  }
  @Get("me") @UseGuards(AuthGuard) me(@Req() req: AuthRequest) {
    return safeUser(req.user);
  }
  @Post("logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.reservacr_session);
    res.clearCookie("reservacr_session", cookie);
    return { ok: true };
  }
}
