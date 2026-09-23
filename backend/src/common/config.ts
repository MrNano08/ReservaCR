import "dotenv/config";
import { z } from "zod";
export const config = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
    DB_HOST: z.string().default("127.0.0.1"),
    DB_PORT: z.coerce.number().default(3306),
    DB_USERNAME: z.string().default("reservacr"),
    DB_PASSWORD: z.string().min(1),
    DB_DATABASE: z.string().default("reservacr"),
    COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().default("ReservaCR <notificaciones@reservacr.local>"),
    SMTP_SECURE: z.enum(["true", "false"]).default("false"),
    UPLOAD_DIR: z.string().default("uploads"),
  })
  .parse(process.env);
if (
  config.NODE_ENV === "production" &&
  (config.COOKIE_SECURE !== "true" || !config.WEB_ORIGIN.startsWith("https://"))
)
  throw new Error("Producción requiere HTTPS y COOKIE_SECURE=true");
