import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import nodemailer from "nodemailer";
import { db } from "../database/data-source";
import { Notification, Booking, User, Business } from "../database/entities";
import { config } from "../common/config";
import { bookingMessage, messageHtml } from "./templates";
import { Language } from "../common/language";

export async function enqueueBooking(
  m: EntityManager,
  b: Booking,
  kind: "confirmada" | "cancelada",
  clientLanguage?: Language,
) {
  const business = await m.findOneByOrFail(Business, { id: b.businessId });

  const recipients = await Promise.all([
    m.findOneByOrFail(User, { id: b.clientId }),
    m.findOneByOrFail(User, { id: business.ownerId }),
  ]);

  for (const [index, u] of recipients.entries()) {
    const language = index === 0 ? clientLanguage ?? u.language ?? "es" : u.language ?? "es";
    const message = bookingMessage(language, kind, index === 0 ? "client" : "owner", {
      serviceName: b.serviceName,
      businessName: business.name,
      startAt: b.startAt,
      code: b.code,
      cancellationReason: b.cancellationReason,
      link: config.WEB_ORIGIN + "/reservas",
    });
    await m.save(Notification, {
      userId: u.id,
      email: u.email,
      subject: message.subject,
      body: message.body,
      nextAttemptAt: new Date(),
    });
  }
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private logger = new Logger("Correo");

  private transport = config.SMTP_HOST
    ? nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE === "true",
        auth: config.SMTP_USER
          ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
          : undefined,
        connectionTimeout: 10000,
        socketTimeout: 15000,
      })
    : null;

  onModuleInit() {
    if (this.transport)
      this.timer = setInterval(() => void this.flush(), 15000);
    else
      this.logger.warn(
        "SMTP no configurado; los correos permanecerán pendientes.",
      );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.transport?.close();
  }

  async flush() {
    if (this.running || !this.transport) return;
    this.running = true;

    try {
      for (let n = 0; n < 20; n++) {
        const found = await db.transaction(async (m) => {
          const job = await m
            .getRepository(Notification)
            .createQueryBuilder("n")
            .where("n.status=:s AND n.nextAttemptAt<=:now", {
              s: "PENDING",
              now: new Date(),
            })
            .orderBy("n.createdAt", "ASC")
            .setLock("pessimistic_write")
            .setOnLocked("skip_locked")
            .getOne();

          if (!job) return false;

          // Row lock prevents two workers delivering the same job concurrently.
          job.attempts++;

          try {
            await this.transport!.sendMail({
              from: config.SMTP_FROM,
              to: job.email,
              subject: job.subject,
              text: job.body,
              html: messageHtml(job.subject, job.body, new URL("/reservas", config.WEB_ORIGIN).toString()),
              messageId: `<${job.id}@reservacr.local>`,
            });
            job.status = "SENT";
          } catch {
            job.status = job.attempts >= 8 ? "FAILED" : "PENDING";
            job.nextAttemptAt = new Date(
              Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts),
            );
            this.logger.warn(
              `Envío pendiente ${job.id}; intento ${job.attempts}.`,
            );
          }

          await m.save(job);
          return true;
        });

        if (!found) break;
      }
    } catch {
      this.logger.error("No se pudo procesar la cola de correo.");
    } finally {
      this.running = false;
    }
  }
}
