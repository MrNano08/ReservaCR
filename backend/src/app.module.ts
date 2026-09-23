import { Module, Global, Controller, Get } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "./auth/auth.service";
import { AuthGuard } from "./auth/guard";
import { AuthController } from "./auth/auth.controller";
import { BusinessesController } from "./businesses/businesses.controller";
import { BusinessesService } from "./businesses/businesses.service";
import { BookingsController } from "./bookings/bookings.controller";
import { BookingsService } from "./bookings/bookings.service";
import { NotificationsService } from "./notifications/notifications.service";
import { NotificationsController } from "./notifications/notifications.controller";
import { db } from "./database/data-source";
@Global()
@Module({
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
  controllers: [AuthController],
})
class AuthModule {}
@Module({ providers: [BusinessesService], controllers: [BusinessesController] })
class BusinessesModule {}
@Module({ providers: [BookingsService], controllers: [BookingsController] })
class BookingsModule {}
@Module({
  providers: [NotificationsService],
  controllers: [NotificationsController],
})
class NotificationsModule {}
@Controller()
class HealthController {
  @Get("health") async health() {
    await db.query("SELECT 1");
    return { status: "ok", database: "connected" };
  }
}
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 180 }]),
    AuthModule,
    BusinessesModule,
    BookingsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
