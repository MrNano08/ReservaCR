import { coded } from "../common/errors";
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
import { passwordResetMessage } from "../notifications/templates";
import { languageOf, Language } from "../common/language";
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
  language: languageOf(u.language),
});

@Injectable()
export class AuthService {
  async requestPasswordReset(email: string, language?: Language) {
    if (!config.SMTP_HOST)
      throw new ServiceUnavailableException(
        coded("MAIL_NOT_CONFIGURED", "El correo no está configurado. Contacta al administrador."),
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
      await transport.sendMail({
        from: config.SMTP_FROM,
        to: user.email,
        ...passwordResetMessage(language ?? user.language ?? "es", link),
      });
    } catch {
      await repo.delete({ id: reset.id });
      throw new ServiceUnavailableException(
        coded("MAIL_SEND_FAILED", "No se pudo enviar el correo. Inténtalo más tarde."),
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
        throw new BadRequestException(coded(reset ? "AUTH_RESET_TOKEN_EXPIRED" : "AUTH_RESET_TOKEN_INVALID", "El enlace venció o ya fue utilizado."));

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
        throw new ConflictException(coded("AUTH_EMAIL_ALREADY_EXISTS", "El correo ya está registrado."));
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
      throw new UnauthorizedException(coded("AUTH_INVALID_CREDENTIALS", "Correo o contraseña incorrectos."));

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
