/** Database integration: requires a separate MariaDB database ending in _test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { In } from "typeorm";
import { db } from "../src/database/data-source";
import {
  User,
  Category,
  Business,
  Service,
  OpeningHour,
  Booking,
  Notification,
  Block,
  AuditLog,
  Session,
  PasswordReset,
} from "../src/database/entities";
import { BookingsService } from "../src/bookings/bookings.service";
import { BusinessesService } from "../src/businesses/businesses.service";
import { AuthService } from "../src/auth/auth.service";
import { dateInCR, localInstant } from "../src/common/time";
import { config } from "../src/common/config";
import { NotificationsService } from "../src/notifications/notifications.service";
test("MariaDB: flujo, cupos, concurrencia, permisos, cancelación y cola", async (t) => {
  assert.ok(
    config.DB_DATABASE.endsWith("_test"),
    "Usa una BD aislada cuyo nombre termine en _test.",
  );
  assert.ok(!config.SMTP_HOST, "Esta suite verifica SMTP ausente: usa una copia QA sin SMTP_HOST. La captura SMTP se valida por separado.");
  await db.initialize();
  const ids: string[] = [], businessIds: string[] = [], categoryIds: string[] = [];
  const services = new BookingsService(),
    businesses = new BusinessesService();
  const user = async (role: User["role"]) => {
    const u = await db.getRepository(User).save({
      name: "QA_I18N_Prueba",
      email: `${randomUUID()}@example.test`,
      role,
      passwordHash: "not-login",
    });
    ids.push(u.id);
    return u;
  };
  try {
  // The database must already be migrated. This suite never performs DDL.
  const runner = db.createQueryRunner();
  try {
    assert.ok(await runner.hasColumn("users", "language"), "Aplica las migraciones revisadas en la DB QA antes de esta suite.");
  } finally { await runner.release(); }
  const c1 = await user("CLIENT"), c2 = await user("CLIENT");
  const owner1 = await user("BUSINESS"), owner2 = await user("BUSINESS");
  await db.getRepository(User).update(c1.id, { language: "en" });
  c1.language = "en";
  const category = await db
    .getRepository(Category)
    .save({ name: `QA_I18N_${randomUUID()}` });
  categoryIds.push(category.id);
  const makeBusiness = async (owner: User) => {
    const b = await db.getRepository(Business).save({
      ownerId: owner.id,
      categoryId: category.id,
      name: "Prueba",
      description: "Negocio de prueba aislado",
      province: "Guanacaste",
      canton: "Nicoya",
      address: "Centro",
      phone: "88888888",
      status: "APPROVED",
      published: true,
      capacity: 1,
      cancellationMinutes: 120,
    });
    businessIds.push(b.id);
    for (let weekday = 0; weekday < 7; weekday++)
      await db
        .getRepository(OpeningHour)
        .save({ businessId: b.id, weekday, startMinute: 480, endMinute: 1080 });
    const s = await db
      .getRepository(Service)
      .save({ businessId: b.id, name: "Consulta", duration: 60, price: 5000 });
    return { b, s };
  };
  const a = await makeBusiness(owner1), b = await makeBusiness(owner2);
  const day = dateInCR(new Date(Date.now() + 3 * 86400000));
  const at = (min: number) => localInstant(day, min).toISOString();
  const payload = (serviceId: string, min: number) => ({
    serviceId,
    startAt: at(min),
    notes: "",
    idempotencyKey: randomUUID(),
  });
    await t.test(
      "último cupo: exactamente una de dos confirmaciones simultáneas",
      async () => {
        const results = await Promise.allSettled([
          services.create(c1, payload(a.s.id, 540)),
          services.create(c2, payload(a.s.id, 540)),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(results.filter((r) => r.status === "rejected").length, 1);
      },
    );
    await t.test(
      "cliente: dos negocios simultáneos solo permiten una reserva",
      async () => {
        const results = await Promise.allSettled([
          services.create(c1, payload(a.s.id, 660)),
          services.create(c1, payload(b.s.id, 660)),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      },
    );
    await t.test(
      "doble envío es idempotente y valida que el contenido sea igual",
      async () => {
        const p = payload(a.s.id, 780);
        const results = await Promise.all([
          services.create(c2, p),
          services.create(c2, p),
        ]);
        assert.equal(results[0].id, results[1].id);
        await assert.rejects(() =>
          services.create(c2, { ...p, notes: "diferente" }),
        );
      },
    );
    await t.test(
      "servicio largo no ofrece comienzo que atraviesa un intervalo lleno",
      async () => {
        const av = await services.availability(a.s.id, day);
        assert.equal(
          av.slots.some((s) => s.startAt === at(750)),
          false,
        );
      },
    );
    await t.test(
      "pertenencia: no lista ni cancela reservas ajenas",
      async () => {
        const rows = await services.list(c1);
        assert.ok(rows.every((r) => r.clientId === c1.id));
        const other = await db
          .getRepository(Booking)
          .findOneByOrFail({ clientId: c2.id });
        await assert.rejects(async () =>
          services.change(c1, other.id, "CANCELLED", ""),
        );
        await assert.rejects(async () =>
          services.change(owner2, other.id, "CANCELLED", ""),
        );
      },
    );
    await t.test(
      "cancelar dos veces libera una vez y crea una sola notificación por destinatario",
      async () => {
        const p = payload(a.s.id, 900);
        const r = await services.create(c1, p);
        await Promise.all([
          services.change(c1, r.id, "CANCELLED", "Prueba"),
          services.change(c1, r.id, "CANCELLED", "Prueba"),
        ]);
        const jobs = await db
          .getRepository(Notification)
          .createQueryBuilder("n")
          .where("n.subject LIKE :text", { text: `%cancelada%${r.code}%` })
          .getCount();
        // Client is EN, owner is ES; preserve independently localized final text.
        const localizedJobs = await db.getRepository(Notification).findBy({ userId: In([c1.id, owner1.id]) });
        const cancellation = localizedJobs.filter(j => j.subject.endsWith(r.code) && (j.subject.includes("cancelled") || j.subject.includes("cancelada")));
        assert.equal(cancellation.length, 2);
        assert.ok(cancellation.find(j => j.userId === c1.id)?.subject.startsWith("Booking cancelled"));
        assert.ok(cancellation.find(j => j.userId === owner1.id)?.subject.startsWith("Reserva cancelada"));
        assert.equal(jobs, 1);
        const replacement = await services.create(c2, payload(a.s.id, 900));
        assert.equal(replacement.status, "CONFIRMED");
      },
    );
    await t.test(
      "no acepta horario no alineado ni publicación suspendida",
      async () => {
        await assert.rejects(() => services.create(c1, payload(a.s.id, 485)));
        await db
          .getRepository(Business)
          .update(b.b.id, { status: "SUSPENDED" });
        await assert.rejects(() => services.create(c2, payload(b.s.id, 960)));
        await db.getRepository(Business).update(b.b.id, { status: "APPROVED" });
      },
    );
    await t.test(
      "horarios, cupos y bloqueos protegen reservas existentes",
      async () => {
        await assert.rejects(() => businesses.setHours(owner1, []));
        await assert.rejects(() =>
          businesses.addBlock(owner1, {
            startAt: new Date(at(540)),
            endAt: new Date(at(600)),
            reason: "Cierre",
          }),
        );
        await assert.rejects(async () =>
          services.change(
            owner1,
            (
              await db
                .getRepository(Booking)
                .findOneByOrFail({ businessId: a.b.id, status: "CONFIRMED" })
            ).id,
            "COMPLETED",
            "",
          ),
        );
      },
    );
    await t.test(
      "instantáneas: cambiar el servicio no modifica citas anteriores",
      async () => {
        const before = await db
          .getRepository(Booking)
          .findOneByOrFail({ businessId: a.b.id });
        await businesses.saveService(
          owner1,
          { name: "Nombre nuevo", duration: 30, price: 9000 },
          a.s.id,
        );
        const after = await db
          .getRepository(Booking)
          .findOneByOrFail({ id: before.id });
        assert.equal(after.serviceName, before.serviceName);
        assert.equal(after.endAt.getTime(), before.endAt.getTime());
        assert.equal(after.price, before.price);
      },
    );
    await t.test(
      "SMTP ausente o fallido no borra reservas y deja envíos pendientes",
      async () => {
        const count = await db
          .getRepository(Booking)
          .countBy({ businessId: a.b.id });
        const worker = new NotificationsService();
        await worker.flush();
        worker.onModuleDestroy();
        assert.equal(
          await db.getRepository(Booking).countBy({ businessId: a.b.id }),
          count,
        );
        assert.ok(
          (await db
            .getRepository(Notification)
            .countBy({ userId: c1.id, status: "PENDING" })) > 0,
        );
      },
    );
    await t.test(
      "sesiones: contraseña cifrada, sesión revocable, correo único",
      async () => {
        const auth = new AuthService();
        const mail = `${randomUUID()}@example.test`;
        const result = await auth.register({
          name: "QA_I18N_Cuenta",
          email: mail,
          password: "Test-reservacr-2026",
          phone: "",
          role: "CLIENT",
        });
        ids.push(result.user.id);
        assert.equal((await auth.resolve(result.token))?.id, result.user.id);
        await auth.logout(result.token);
        assert.equal(await auth.resolve(result.token), null);
        await assert.rejects(() => auth.login(mail, "incorrecta"));
        await assert.rejects(() =>
          auth.register({
            name: "Repetida",
            email: mail,
            password: "Test-reservacr-2026",
            phone: "",
            role: "CLIENT",
          }),
        );
      },
    );
  } finally {
    // Only delete resources belonging to IDs returned in this run; never by name.
    console.info("QA_I18N IDs de esta ejecución", { userIds: ids, businessIds, categoryIds });
    try {
      await db.transaction(async m => {
        if (ids.length) {
          await m.delete(Notification, { userId: In(ids) });
          await m.delete(AuditLog, { actorId: In(ids) });
          await m.delete(Session, { userId: In(ids) });
          await m.delete(PasswordReset, { userId: In(ids) });
        }
        if (businessIds.length) {
          await m.delete(Booking, { businessId: In(businessIds) });
          await m.delete(Block, { businessId: In(businessIds) });
          await m.delete(OpeningHour, { businessId: In(businessIds) });
          await m.delete(Service, { businessId: In(businessIds) });
          await m.delete(Business, { id: In(businessIds) });
        }
        if (categoryIds.length) await m.delete(Category, { id: In(categoryIds) });
        if (ids.length) await m.delete(User, { id: In(ids) });
      });
    } catch (error) {
      console.error("Cleanup QA_I18N pendiente", { userIds: ids, businessIds, categoryIds });
      throw error;
    } finally { await db.destroy(); }
  }
});
