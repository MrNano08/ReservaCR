/** Database integration: requires a separate MariaDB database ending in _test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/database/data-source";
import {
  User,
  Category,
  Business,
  Service,
  OpeningHour,
  Booking,
  Notification,
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
  await db.initialize();
  await db.runMigrations({ transaction: "none" });
  const ids: string[] = [];
  const services = new BookingsService(),
    businesses = new BusinessesService();
  const user = async (role: User["role"]) => {
    const u = await db.getRepository(User).save({
      name: "Prueba",
      email: `${randomUUID()}@example.test`,
      role,
      passwordHash: "not-login",
    });
    ids.push(u.id);
    return u;
  };
  const [c1, c2, owner1, owner2] = await Promise.all([
    user("CLIENT"),
    user("CLIENT"),
    user("BUSINESS"),
    user("BUSINESS"),
  ]);
  const category = await db
    .getRepository(Category)
    .save({ name: `Test ${randomUUID()}` });
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
    for (let weekday = 0; weekday < 7; weekday++)
      await db
        .getRepository(OpeningHour)
        .save({ businessId: b.id, weekday, startMinute: 480, endMinute: 1080 });
    const s = await db
      .getRepository(Service)
      .save({ businessId: b.id, name: "Consulta", duration: 60, price: 5000 });
    return { b, s };
  };
  const [a, b] = await Promise.all([
    makeBusiness(owner1),
    makeBusiness(owner2),
  ]);
  const day = dateInCR(new Date(Date.now() + 3 * 86400000));
  const at = (min: number) => localInstant(day, min).toISOString();
  const payload = (serviceId: string, min: number) => ({
    serviceId,
    startAt: at(min),
    notes: "",
    idempotencyKey: randomUUID(),
  });
  try {
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
        assert.equal(jobs, 2);
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
          name: "Cuenta",
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
    await db.destroy();
  }
});
