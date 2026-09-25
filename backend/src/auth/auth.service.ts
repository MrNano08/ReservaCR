import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { MoreThan } from "typeorm";
import nodemailer from "nodemailer";
import { config } from "../common/config";
import { db } from "../database/data-source";
import { User, Session, PasswordReset, Role } from "../database/entities";

export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const safeUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
});

@Injectable()
export class AuthService {
  async requestPasswordReset(email: string) {
    if (!config.SMTP_HOST)
      throw new ServiceUnavailableException(
        "El correo no está configurado. Contacta al administrador.",
      );

    const user = await db.getRepository(User).findOneBy({ email, active: true });
    if (!user) return { ok: true };

    const token = randomBytes(32).toString("hex");
    const repo = db.getRepository(PasswordReset);
    const reset = await repo.save(
      repo.create({
        userId: user.id,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 30 * 60000),
      }),
    );

    const transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE === "true",
      auth: config.SMTP_USER
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });

    try {
      const resetUrl = new URL("/restablecer-contrasena", config.WEB_ORIGIN);
      resetUrl.searchParams.set("token", token);
      const link = resetUrl.toString();
      const htmlLink = link.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

      await transport.sendMail({
        from: config.SMTP_FROM,
        to: user.email,
        subject: "Recuperar contraseña · ReservaCR",
        text: `Solicitaste cambiar tu contraseña en ReservaCR. Abre este enlace en los próximos 30 minutos:
${link}

Si no solicitaste el cambio, ignora este mensaje.`,
        html: `<!doctype html>
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
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#edf1eb;">Recuperar contraseña</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#edf1eb;">Recibimos una solicitud para cambiar la contraseña de tu cuenta. Presiona el botón para crear una nueva.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" bgcolor="#c4f29a" style="border-radius:12px;">
              <a href="${htmlLink}" style="display:block;padding:17px 20px;font-size:16px;font-weight:bold;color:#17230f;text-decoration:none;">Restablecer contraseña</a>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#a0afa4;">Este enlace vence en 30 minutos. Si no solicitaste el cambio, puedes ignorar este mensaje.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 4px;color:#a0afa4;font-size:12px;line-height:1.5;">
        Si el botón no funciona, copia este enlace en tu navegador:<br>
        <a href="${htmlLink}" style="color:#c4f29a;word-break:break-all;">${htmlLink}</a>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });
    } catch {
      await repo.delete({ id: reset.id });
      throw new ServiceUnavailableException(
        "No se pudo enviar el correo. Inténtalo más tarde.",
      );
    } finally {
      transport.close();
    }

    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    await db.transaction(async (m) => {
      const reset = await m
        .getRepository(PasswordReset)
        .createQueryBuilder("r")
        .where("r.tokenHash = :hash", { hash: digest(token) })
        .setLock("pessimistic_write")
        .getOne();

      if (!reset || reset.expiresAt <= new Date())
        throw new BadRequestException("El enlace venció o ya fue utilizado.");

      await m
        .getRepository(User)
        .update({ id: reset.userId }, { passwordHash: await hash(password, 12) });
      await m.getRepository(Session).delete({ userId: reset.userId });
      await m.getRepository(PasswordReset).delete({ userId: reset.userId });
    });

    return { ok: true };
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: Role;
  }) {
    const repo = db.getRepository(User);
    const user = repo.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      passwordHash: await hash(data.password, 12),
    });

    try {
      await repo.save(user);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY")
        throw new ConflictException("El correo ya está registrado.");
      throw e;
    }

    return this.session(user);
  }

  async login(email: string, password: string) {
    const user = await db
      .getRepository(User)
      .createQueryBuilder("u")
      .addSelect("u.passwordHash")
      .where("u.email=:email", { email })
      .getOne();

    const valid = await compare(
      password,
      user?.passwordHash ||
        "$2b$12$7Xx45VkVeWGvuWrNXVDKJuuafCCZBCpHzBCDK.iFRPi1AJwdOgZeW",
    );

    if (!user || !valid || !user.active)
      throw new UnauthorizedException("Correo o contraseña incorrectos.");

    return this.session(user);
  }

  async session(user: User) {
    const token = randomBytes(32).toString("hex");

    await db.getRepository(Session).save({
      userId: user.id,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    return { user: safeUser(user), token };
  }

  async resolve(token?: string) {
    if (!token || token.length !== 64) return null;

    const s = await db.getRepository(Session).findOne({
      where: { tokenHash: digest(token), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });

    return s?.user.active ? s.user : null;
  }

  async logout(token?: string) {
    if (token)
      await db.getRepository(Session).delete({ tokenHash: digest(token) });
  }
}