import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { AuthGuard, AuthRequest, Roles } from "../auth/guard";
import { db } from "../database/data-source";
import { Notification } from "../database/entities";
import { id } from "../common/validation";
@Controller()
@UseGuards(AuthGuard)
export class NotificationsController {
  @Get("notifications") list(@Req() req: AuthRequest) {
    return db.getRepository(Notification).find({
      where: { userId: req.user.id },
      select: ["id", "subject", "body", "read", "createdAt"],
      order: { createdAt: "DESC" },
      take: 100,
    });
  }
  @Patch("notifications/:id/read") async read(
    @Req() req: AuthRequest,
    @Param("id") value: string,
  ) {
    await db
      .getRepository(Notification)
      .update({ id: id(value), userId: req.user.id }, { read: true });
    return { ok: true };
  }
  @Get("admin/notifications") @Roles("ADMIN") jobs() {
    return db.getRepository(Notification).find({
      select: [
        "id",
        "subject",
        "status",
        "attempts",
        "nextAttemptAt",
        "createdAt",
      ],
      order: { createdAt: "DESC" },
      take: 200,
    });
  }
  @Post("admin/notifications/:id/retry") @Roles("ADMIN") async retry(
    @Param("id") value: string,
  ) {
    const r = await db
      .getRepository(Notification)
      .update(
        { id: id(value), status: "FAILED" },
        { status: "PENDING", attempts: 0, nextAttemptAt: new Date() },
      );
    if (!r.affected)
      throw new NotFoundException(
        "No hay un envío fallido con ese identificador.",
      );
    return { ok: true };
  }
}
