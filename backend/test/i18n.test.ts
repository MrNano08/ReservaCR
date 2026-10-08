import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BadRequestException, HttpException, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import nodemailer from "nodemailer";
import { createServer, Socket } from "node:net";
import { compare } from "bcryptjs";
import { AuthController } from "../src/auth/auth.controller";
import { EntityManager } from "typeorm";
import { languageOf } from "../src/common/language";
import { coded, errorResponse, Errors } from "../src/common/errors";
import { parse } from "../src/common/validation";
import { bookingMessage, passwordResetMessage, messageHtml } from "../src/notifications/templates";
import { enqueueBooking, NotificationsService } from "../src/notifications/notifications.service";
import { AuthService, safeUser } from "../src/auth/auth.service";
import { User, Business, Booking, Notification, PasswordReset, Session } from "../src/database/entities";
import { db } from "../src/database/data-source";
import { config } from "../src/common/config";
import { UserLanguage1790000000002 } from "../src/database/migrations/UserLanguage";
import { QueryRunner } from "typeorm";
import { ArgumentsHost } from "@nestjs/common";

const data = {
  serviceName: 'Servicio <img src=x onerror="alert(1)">', businessName: "Negocio & nombre",
  startAt: new Date("2026-10-05T03:00:00Z"), code: "CR-123",
  cancellationReason: "Motivo: cancelada\nUser <script>text</script>", link: "http://localhost:5173/reservas",
};

test("idioma estricto y serialización segura: inválido/ausente usa ES", () => {
  for (const value of [undefined, null, "ES", "fr", "en-US", ""]) assert.equal(languageOf(value), "es");
  assert.equal(languageOf("en"), "en");
  const user = Object.assign(new User(), { id: "u", language: "en", passwordHash: "secret" });
  assert.equal(safeUser(user).language, "en");
  assert.equal("passwordHash" in safeUser(user), false);
});

test("reserva creada/cancelada ES/EN, cliente/dueño: datos intactos, zona CR y HTML escapado", () => {
  for (const language of ["es", "en", undefined, "invalid"])
    for (const kind of ["confirmada", "cancelada"] as const)
      for (const recipient of ["client", "owner"] as const) {
        const result = bookingMessage(language, kind, recipient, data);
        assert.ok(result.body.includes(data.serviceName));
        assert.ok(result.body.includes(data.businessName));
        assert.ok(result.body.includes(data.cancellationReason));
        assert.ok(result.body.includes(data.link));
        assert.ok(result.body.includes(language === "en" ? "Sunday, October 4" : "domingo, 4 de octubre"));
        assert.ok(result.subject.startsWith(language === "en" ? "Booking" : "Reserva"));
        const html = messageHtml(result.subject, result.body);
        assert.equal(html.includes("<script>"), false);
        assert.equal(html.includes("<img src=x"), false);
        assert.ok(html.includes("&lt;script&gt;"));
      }
});

test("recuperación ES/EN: mismo enlace/token y fallback ES", () => {
  const link = "http://localhost:5173/restablecer-contrasena?token=abc&extra=1";
  for (const language of ["es", "en", undefined, "invalid"]) {
    const result = passwordResetMessage(language, link);
    assert.ok(result.text.includes(link));
    assert.ok(result.text.includes("30"));
    assert.ok(result.subject.startsWith(language === "en" ? "Reset password" : "Recuperar contraseña"));
    assert.ok(result.html.includes("&amp;extra=1"));
    assert.ok(result.html.includes(`href="${link.replace(/&/g, "&amp;")}"`));
  }
});

test("cola: idioma de cada destinatario, no de otra sesión; solo crea nuevos subject/body", async () => {
  const business = Object.assign(new Business(), { id: "b", name: data.businessName, ownerId: "owner" });
  const client = Object.assign(new User(), { id: "client", email: "client@example.test", language: "en" });
  const owner = Object.assign(new User(), { id: "owner", email: "owner@example.test", language: "es" });
  const saved: Partial<Notification>[] = [];
  const manager = {
    findOneByOrFail: async (entity: unknown, where: { id: string }) => entity === Business ? business : where.id === client.id ? client : owner,
    save: async (entity: unknown, value: Partial<Notification>) => { assert.equal(entity, Notification); saved.push(value); return value; },
  } as unknown as EntityManager;
  const booking = Object.assign(new Booking(), data, { businessId: "b", clientId: client.id });
  for (const kind of ["confirmada", "cancelada"] as const) {
    await enqueueBooking(manager, booking, kind);
    const [c, o] = saved.slice(-2);
    assert.equal(c.userId, client.id); assert.equal(c.email, client.email);
    assert.equal(o.userId, owner.id); assert.equal(o.email, owner.email);
    assert.ok(c.subject!.startsWith("Booking")); assert.ok(o.subject!.startsWith("Reserva"));
    assert.equal("metadata" in c, false); assert.equal("notificationKey" in c, false);
  }
  assert.equal(saved.length, 4);
});

test("Auth: idioma solicitado, fallback, validación y token por SMTP local sin DB", async () => {
  const originalRepository = db.getRepository, originalTransaction = db.transaction;
  const originalConfig = { ...config };
  const messages: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8");
    socket.write("220 localhost SMTP QA\r\n");
    let buffer = "", receiving = false, message = "";
    socket.on("data", chunk => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (receiving) {
          if (line === ".") {
            messages.push(message); message = ""; receiving = false;
            socket.write("250 accepted\r\n");
          } else message += line.replace(/^\.\./, ".") + "\r\n";
        } else if (/^EHLO/.test(line)) socket.write("250 localhost\r\n");
        else if (line === "DATA") { receiving = true; socket.write("354 send data\r\n"); }
        else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  Object.assign(config, { SMTP_HOST: "127.0.0.1", SMTP_PORT: address.port, SMTP_SECURE: "false", SMTP_USER: undefined, SMTP_PASSWORD: undefined });
  const user = { id: "u", email: "qa@example.test", language: "es" as string | undefined, passwordHash: "original" };
  let exists = true, resetCount = 0;
  let stored: { userId: string; tokenHash: string; expiresAt: Date } | undefined;
  const deleted: unknown[] = [];
  const userRepo = {
    findOneBy: async () => exists ? user : null,
    update: async (_where: unknown, value: { passwordHash: string }) => { user.passwordHash = value.passwordHash; },
  };
  const resetRepo = {
    create: (value: typeof stored) => value,
    save: async (value: NonNullable<typeof stored>) => { resetCount++; stored = value; return { ...value, id: "reset" }; },
    createQueryBuilder: () => {
      const query = {
        where: (_sql: string, params: { hash: string }) => { if (stored) assert.equal(params.hash, stored.tokenHash); return query; },
        setLock: () => query, getOne: async () => stored,
      };
      return query;
    },
    delete: async () => { stored = undefined; deleted.push(PasswordReset); },
  };
  db.getRepository = ((entity: unknown) => entity === User ? userRepo : entity === PasswordReset ? resetRepo
    : entity === Session ? { delete: async () => { deleted.push(Session); } } : assert.fail("unexpected repository")) as unknown as typeof db.getRepository;
  db.transaction = ((run: (manager: unknown) => Promise<unknown>) => run({ getRepository: db.getRepository })) as typeof db.transaction;
  try {
    const controller = new AuthController(new AuthService());
    const cases = [
      { saved: "es", requested: "en", expected: "en" },
      { saved: "en", requested: "es", expected: "es" },
      { saved: "en", requested: undefined, expected: "en" },
      { saved: "es", requested: undefined, expected: "es" },
      { saved: "invalid", requested: undefined, expected: "es" },
      { saved: undefined, requested: undefined, expected: "es" },
    ];
    for (const c of cases) {
      user.language = c.saved;
      const body = { email: user.email, ...(c.requested ? { language: c.requested } : {}) };
      assert.deepEqual(await controller.forgot(body), { ok: true });
      assert.equal(user.language, c.saved, "la solicitud no modifica users.language");
      assert.equal(user.passwordHash, "original");
      const raw = messages.at(-1)!;
      const subject = raw.match(/^Subject: (.*)$/m)![1].trim();
      const decoded = subject.replace(/=\?UTF-8\?([BQ])\?([^?]+)\?=/gi, (_match, encoding, value) =>
        encoding.toUpperCase() === "B" ? Buffer.from(value, "base64").toString("utf8")
          : decodeURIComponent(value.replace(/_/g, " ").replace(/=([a-f0-9]{2})/gi, "%$1")));
      assert.ok(decoded.startsWith(c.expected === "en" ? "Reset password" : "Recuperar contraseña"), decoded);
      assert.ok(raw.includes(c.expected === "en" ? "You requested" : "Solicitaste"));
      assert.match(raw.replace(/=\r\n/g, ""), /token(?:=|=3D)[a-f0-9]{64}/);
    }
    const count = messages.length;
    assert.throws(() => controller.forgot({ email: user.email, language: "fr" }), error =>
      error instanceof BadRequestException && error.getStatus() === 400);
    exists = false;
    for (const language of ["en", "es", undefined]) {
      assert.deepEqual(await controller.forgot({ email: "missing@example.test", ...(language ? { language } : {}) }), { ok: true });
    }
    assert.equal(messages.length, count); assert.equal(resetCount, cases.length);
    const received = messages.at(-1)!.replace(/=\r\n/g, "");
    const token = received.match(/token(?:=|=3D)([a-f0-9]{64})/)![1];
    assert.deepEqual(await controller.reset({ token, password: "NewPassword123!" }), { ok: true });
    assert.ok(await compare("NewPassword123!", user.passwordHash));
    assert.equal(user.language, undefined);
    assert.deepEqual(deleted, [Session, PasswordReset]);
    await assert.rejects(controller.reset({ token, password: "AnotherPassword123!" }), BadRequestException);
  } finally {
    db.getRepository = originalRepository; db.transaction = originalTransaction;
    Object.assign(config, originalConfig);
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("worker: histórico literal, HTML escapado y mismos estados/reintentos", async () => {
  const originalTransaction = db.transaction, originalTransport = nodemailer.createTransport;
  const originalHost = config.SMTP_HOST;
  config.SMTP_HOST = "qa.invalid";
  try {
    for (const fail of [false, true]) {
      const job = Object.assign(new Notification(), {
        id: "QA_I18N_JOB", subject: "Asunto histórico & original",
        body: "Historic body\nMotivo: cancelada <script>contenido</script>",
        email: "qa@example.test", status: "PENDING", attempts: fail ? 7 : 0,
        nextAttemptAt: new Date(),
      });
      const original = { subject: job.subject, body: job.body, email: job.email };
      let used = false, saved = 0, sent = 0;
      const query = {
        where: () => query, orderBy: () => query, setLock: () => query, setOnLocked: () => query,
        getOne: async () => { if (used) return null; used = true; return job; },
      };
      const manager = {
        getRepository: () => ({ createQueryBuilder: () => query }),
        save: async (value: Notification) => { assert.equal(value, job); saved++; return job; },
      };
      db.transaction = ((run: (manager: unknown) => Promise<unknown>) => run(manager)) as unknown as typeof db.transaction;
      nodemailer.createTransport = (() => ({
        sendMail: async (mail: { to: string; subject: string; text: string; html: string; messageId: string }) => {
          sent++;
          assert.equal(mail.to, original.email); assert.equal(mail.subject, original.subject); assert.equal(mail.text, original.body);
          assert.ok(mail.html.includes("Historic body")); assert.equal(mail.html.includes("<script>"), false);
          assert.ok(mail.html.includes(`href="${new URL("/reservas", config.WEB_ORIGIN).toString()}"`));
          assert.equal(mail.messageId, "<QA_I18N_JOB@reservacr.local>");
          if (fail) throw new Error("QA SMTP failure");
        }, close: () => {},
      })) as unknown as typeof nodemailer.createTransport;
      const worker = new NotificationsService();
      try { await worker.flush(); } finally { worker.onModuleDestroy(); }
      assert.equal(sent, 1); assert.equal(saved, 1);
      assert.equal(job.status, fail ? "FAILED" : "SENT");
      assert.equal(job.attempts, fail ? 8 : 1);
      assert.equal(job.subject, original.subject); assert.equal(job.body, original.body);
    }
  } finally { db.transaction = originalTransaction; nodemailer.createTransport = originalTransport; config.SMTP_HOST = originalHost; }
});

test("errores: código/mensaje/status; Zod no cambia validaciones; 500 no expone detalles", () => {
  const old = new UnauthorizedException("Inicia sesión para continuar.");
  assert.deepEqual(errorResponse(old), { statusCode: 401, code: "AUTH_UNAUTHORIZED", message: "Inicia sesión para continuar." });
  assert.deepEqual(errorResponse(new BadRequestException(coded("BOOKING_INVALID_DATE", "Fecha inválida."))), { statusCode: 400, code: "BOOKING_INVALID_DATE", message: "Fecha inválida." });
  assert.equal(errorResponse({ code: "ER_DUP_ENTRY" }).statusCode, 409);
  const hidden = errorResponse(new HttpException({ code: "SQL_SECRET", message: "secret", fieldErrors: ["secret"] }, 500));
  assert.equal(hidden.code, "INTERNAL_ERROR"); assert.equal(JSON.stringify(hidden).includes("secret"), false);
  const schema = z.object({ name: z.string().min(2) }).strict();
  assert.deepEqual(parse(schema, { name: "QA" }), { name: "QA" });
  assert.throws(() => parse(schema, { name: "" }), (e: unknown) => {
    const response = errorResponse(e);
    assert.equal(response.statusCode, 400); assert.equal(response.code, "VALIDATION_ERROR");
    assert.ok(String(response.message).startsWith("name: ")); assert.ok(response.fieldErrors);
    return true;
  });
  let status = 0, body: unknown;
  const res = { status: (value: number) => { status = value; return res; }, json: (value: unknown) => { body = value; } };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new Errors().catch(old, host);
  assert.equal(status, 401); assert.deepEqual(body, errorResponse(old));
});

test("migración aditiva: default ES, constraint ES/EN y registro sin tocar migraciones previas", async () => {
  const statements: string[] = [];
  await new UserLanguage1790000000002().up({ query: async (sql: string) => { statements.push(sql); } } as unknown as QueryRunner);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /ADD COLUMN language varchar\(2\) NOT NULL DEFAULT 'es'/);
  assert.match(statements[0], /CHECK \(BINARY language IN \('es', 'en'\)\)/);
  assert.equal(/DROP|DELETE|UPDATE/.test(statements[0]), false);
  assert.ok(db.options.migrations);
});

test("todos los códigos implementados tienen traducción ES/EN", () => {
  const root = resolve(__dirname, "../..");
  const es = JSON.parse(readFileSync(resolve(root, "frontend/src/i18n/locales/es/errors.json"), "utf8"));
  const en = JSON.parse(readFileSync(resolve(root, "frontend/src/i18n/locales/en/errors.json"), "utf8"));
  const files = ["auth/auth.service.ts", "auth/guard.ts", "businesses/businesses.service.ts", "businesses/businesses.controller.ts", "bookings/bookings.service.ts", "notifications/notifications.controller.ts", "common/errors.ts", "common/validation.ts", "main.ts"];
  const codes = new Set<string>();
  for (const file of files) {
    const source = readFileSync(resolve(root, "backend/src", file), "utf8");
    // Audit codes at exception sites, excluding audit actions and domain enums.
    for (const call of source.matchAll(/coded\(([^,]+),/g))
      for (const value of call[1].matchAll(/"([A-Z]+(?:_[A-Z]+)+)"/g)) codes.add(value[1]);
    for (const value of source.matchAll(/code:\s*"([A-Z]+(?:_[A-Z]+)+)"/g)) codes.add(value[1]);
    if (file === "common/errors.ts")
      for (const value of source.matchAll(/"([A-Z]+(?:_[A-Z]+)+)"/g))
        if (value[1] !== "ER_DUP_ENTRY") codes.add(value[1]);
  }
  for (const code of codes) { assert.ok(es[code], `ES missing ${code}`); assert.ok(en[code], `EN missing ${code}`); }
  assert.ok(codes.size > 30);
});
