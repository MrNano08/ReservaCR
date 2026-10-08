import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, Roles, AuthRequest } from "../auth/guard";
import { AuthService } from "../auth/auth.service";
import { Request } from "express";
import { parse, id, idSchema, text } from "../common/validation";
import { BookingsService } from "./bookings.service";
@Controller()
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly auth: AuthService,
  ) {}
  @Get("availability") async availability(
    @Query() query: unknown,
    @Req() req: Request,
  ) {
    const d = parse(
      z.object({
        serviceId: idSchema,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
      query,
    );
    const user = await this.auth.resolve(req.cookies?.reservacr_session);
    return this.bookings.availability(
      d.serviceId,
      d.date,
      user?.role === "CLIENT" ? user.id : undefined,
    );
  }
  @Post("bookings") @UseGuards(AuthGuard) @Roles("CLIENT") create(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.bookings.create(
      req.user,
      parse(
        z
          .object({
            serviceId: idSchema,
            startAt: z.iso.datetime({ offset: true }),
            notes: text(500, 0).default(""),
            idempotencyKey: z.string().uuid(),
            language: z.enum(["es", "en"]).optional(),
          })
          .strict(),
        body,
      ),
    );
  }
  @Get("bookings") @UseGuards(AuthGuard) @Roles("CLIENT", "BUSINESS") list(
    @Req() req: AuthRequest,
  ) {
    return this.bookings.list(req.user);
  }
  @Patch("bookings/:id")
  @UseGuards(AuthGuard)
  @Roles("CLIENT", "BUSINESS")
  change(
    @Req() req: AuthRequest,
    @Param("id") value: string,
    @Body() body: unknown,
  ) {
    const d = parse(
      z
        .object({
          status: z.enum(["CANCELLED", "COMPLETED", "NO_SHOW"]),
          reason: text(300, 0).default(""),
          language: z.enum(["es", "en"]).optional(),
        })
        .strict(),
      body,
    );
    return this.bookings.change(req.user, id(value), d.status, d.reason, d.language);
  }
}
