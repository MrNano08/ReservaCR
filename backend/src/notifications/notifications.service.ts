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
import { formatCR } from "../common/time";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]!,
  );

function bookingEmail(job: Notification) {
  const [
    service = "",
    business = "",
    date = "",
    code = "",
    status = "",
    ...rest
  ] = job.body.split("\n");

  const cancelled = status.toLowerCase().includes("cancelada");
  const reason = rest.find((line) => line.startsWith("Motivo: "));
  const link = escapeHtml(
    new URL("/reservas", config.WEB_ORIGIN).toString(),
  );

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:9px 0;color:#a0afa4;font-size:14px;vertical-align:top;">${label}</td>
      <td style="padding:9px 0;color:#edf1eb;font-size:14px;text-align:right;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:32px 12px;background:#101713;font-family:Arial,Helvetica,sans-serif;color:#edf1eb;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 4px 20px;font-size:22px;font-weight:bold;color:#c4f29a;">ReservaCR</td>
    </tr>
    <tr>
      <td style="background:#18221c;border:1px solid #2c3a30;border-radius:18px;padding:36px 32px;">
        <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#edf1eb;">${cancelled ? "Reserva cancelada" : "Reserva confirmada"}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#a0afa4;">${cancelled ? "Tu reserva fue cancelada. Aquí tienes los detalles:" : "Tu reserva está confirmada. Aquí tienes los detalles:"}</p>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #2c3a30;border-bottom:1px solid #2c3a30;">
          ${row("Servicio", service)}
          ${row("Negocio", business)}
          ${row("Fecha y hora", date)}
          ${row("Código", code.replace(/^Código: /, ""))}
          ${reason ? row("Motivo", reason.slice(8)) : ""}
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;">
          <tr>
            <td align="center" bgcolor="#c4f29a" style="border-radius:12px;">
              <a href="${link}" style="display:block;padding:17px 20px;font-size:16px;font-weight:bold;color:#17230f;text-decoration:none;">Ver mis reservas</a>
            </td>
          </tr>
        </table>

        <p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#a0afa4;">Puedes consultar el estado de tus reservas en ReservaCR.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 4px;color:#a0afa4;font-size:12px;line-height:1.5;">
        Si el botón no funciona, abre:
        <a href="${link}" style="color:#c4f29a;word-break:break-all;">${link}</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function enqueueBooking(
  m: EntityManager,
  b: Booking,
  kind: string,
) {
  const business = await m.findOneByOrFail(Business, { id: b.businessId });

  const recipients = await Promise.all([
    m.findOneByOrFail(User, { id: b.clientId }),
    m.findOneByOrFail(User, { id: business.ownerId }),
  ]);

  for (const u of recipients)
    await m.save(Notification, {
      userId: u.id,
      email: u.email,
      subject: `Reserva ${kind} · ${b.code}`,
      body: `${b.serviceName}\n${business.name}\n${formatCR(b.startAt)}\nCódigo: ${b.code}\nEstado: ${kind}${b.cancellationReason ? "\nMotivo: " + b.cancellationReason : ""}\nConsulta los detalles en ${config.WEB_ORIGIN}/reservas`,
      nextAttemptAt: new Date(),
    });
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
              html: bookingEmail(job),
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