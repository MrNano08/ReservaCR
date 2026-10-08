import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Errors } from "./common/errors";
import { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { resolve } from "node:path";
import { config } from "./common/config";
import { db } from "./database/data-source";
import { AppModule } from "./app.module";
export async function bootstrap() {
  await db.initialize();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cookieParser());
  app.enableCors({ origin: config.WEB_ORIGIN, credentials: true });
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("X-Requested-With") !== "ReservaCR" ||
        (req.get("Origin") && req.get("Origin") !== config.WEB_ORIGIN))
    )
      return res
        .status(403)
        .json({ statusCode: 403, code: "AUTH_FORBIDDEN", message: "Origen de solicitud no autorizado." });
    next();
  });
  app.useStaticAssets(resolve(config.UPLOAD_DIR), {
    prefix: "/uploads/",
    dotfiles: "deny",
    index: false,
  });
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  await app.listen(config.PORT, "0.0.0.0");
  return app;
}
if (require.main === module)
  bootstrap().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
