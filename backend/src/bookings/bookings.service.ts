import { coded } from "../common/errors";
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { randomUUID } from "node:crypto";
import { db } from "../database/data-source";
import {
  Booking,
  Business,
  Service,
  OpeningHour,
  Block,
  User,
  AuditLog,
} from "../database/entities";
import {
  dateInCR,
  localInstant,
  weekday,
  validDay,
  fitsCapacity,
  overlaps,
  SLOT,
} from "../common/time";
import { enqueueBooking } from "../notifications/notifications.service";
@Injectable()
export class BookingsService {
  async availability(
    serviceId: string,
    day: string,
    clientId?: string,
    m: EntityManager = db.manager,
  ) {
    if (!validDay(day)) throw new BadRequestException(coded("BOOKING_INVALID_DATE", "Fecha inválida."));
    if (
      day < dateInCR(new Date()) ||
      day > dateInCR(new Date(Date.now() + 90 * 86400000))
    )
      throw new BadRequestException(
        coded("BOOKING_DATE_OUT_OF_RANGE", "Selecciona una fecha dentro de los próximos 90 días."),
      );
    const service = await m.findOneBy(Service, { id: serviceId, active: true });
    if (!service) throw new NotFoundException(coded("BOOKING_SERVICE_NOT_FOUND", "Servicio no disponible."));
    const b = await m.findOneBy(Business, { id: service.businessId });
    if (!b || b.status !== "APPROVED" || !b.published)
      throw new ConflictException(coded("BUSINESS_BOOKINGS_UNAVAILABLE", "El negocio no admite nuevas reservas."));
    const start = localInstant(day, 0),
      end = localInstant(day, 1440);
    const [hours, bookings, blocks, clientBookings] = await Promise.all([
      m.findBy(OpeningHour, { businessId: b.id, weekday: weekday(day) }),
      m
        .getRepository(Booking)
        .createQueryBuilder("r")
        .where(
          "r.businessId=:id AND r.status=:s AND r.startAt<:end AND r.endAt>:start",
          { id: b.id, s: "CONFIRMED", start, end },
        )
        .getMany(),
      m
        .getRepository(Block)
        .createQueryBuilder("r")
        .where("r.businessId=:id AND r.startAt<:end AND r.endAt>:start", {
          id: b.id,
          start,
          end,
        })
        .getMany(),
      clientId
        ? m
            .getRepository(Booking)
            .createQueryBuilder("r")
            .where(
              "r.clientId=:id AND r.status=:s AND r.startAt<:end AND r.endAt>:start",
              { id: clientId, s: "CONFIRMED", start, end },
            )
            .getMany()
        : Promise.resolve([]),
    ]);
    const slots: { startAt: string; endAt: string; remaining: number }[] = [];
    for (const h of hours)
      for (
        let minute = h.startMinute;
        minute + service.duration <= h.endMinute;
        minute += SLOT
      ) {
        const s = localInstant(day, minute),
          e = localInstant(day, minute + service.duration);
        if (
          s <= new Date() ||
          blocks.some((x) => overlaps(s, e, x.startAt, x.endAt)) ||
          clientBookings.some((x) => overlaps(s, e, x.startAt, x.endAt)) ||
          !fitsCapacity(s, e, b.capacity, bookings)
        )
          continue;
        let remaining = b.capacity;
        for (let t = s.getTime(); t < e.getTime(); t += SLOT * 60000)
          remaining = Math.min(
            remaining,
            b.capacity -
              bookings.filter((x) =>
                overlaps(
                  new Date(t),
                  new Date(t + SLOT * 60000),
                  x.startAt,
                  x.endAt,
                ),
              ).length,
          );
        slots.push({
          startAt: s.toISOString(),
          endAt: e.toISOString(),
          remaining,
        });
      }
    return {
      day,
      service,
      slots: slots.sort((a, b) => a.startAt.localeCompare(b.startAt)),
    };
  }
  async create(
    user: User,
    data: {
      serviceId: string;
      startAt: string;
      notes: string;
      idempotencyKey: string;
    },
  ) {
    const service = await db
      .getRepository(Service)
      .findOneBy({ id: data.serviceId });
    if (!service) throw new NotFoundException(coded("BOOKING_SERVICE_NOT_FOUND", "Servicio no encontrado."));
    return db.transaction("READ COMMITTED", async (m) => {
      // Stable lock order: client then business. Shared business capacity and cross-business client overlap are serialized.
      await m.getRepository(User).findOne({
        where: { id: user.id },
        lock: { mode: "pessimistic_write" },
      });
      await m.getRepository(Business).findOne({
        where: { id: service.businessId },
        lock: { mode: "pessimistic_write" },
      });
      const existing = await m.findOneBy(Booking, {
        clientId: user.id,
        idempotencyKey: data.idempotencyKey,
      });
      if (existing) {
        if (
          existing.serviceId !== data.serviceId ||
          existing.startAt.getTime() !== new Date(data.startAt).getTime() ||
          existing.notes !== data.notes
        )
          throw new ConflictException(
            coded("BOOKING_REQUEST_CONFLICT", "La clave de solicitud ya fue utilizada para otra reserva."),
          );
        return existing;
      }
      const start = new Date(data.startAt);
      const available = await this.availability(
        data.serviceId,
        dateInCR(start),
        user.id,
        m,
      );
      const slot = available.slots.find(
        (s) => s.startAt === start.toISOString(),
      );
      if (!slot)
        throw new ConflictException(
          coded("BOOKING_SLOT_UNAVAILABLE", "El horario no está disponible o se cruza con otra de tus reservas. Selecciona otro."),
        );
      const b = await m.save(Booking, {
        clientId: user.id,
        businessId: service.businessId,
        serviceId: service.id,
        serviceName: available.service.name,
        serviceNameEn: available.service.nameEn || null,
        price: available.service.price,
        startAt: start,
        endAt: new Date(slot.endAt),
        notes: data.notes,
        idempotencyKey: data.idempotencyKey,
        code: `CR-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      });
      await enqueueBooking(m, b, "confirmada");
      await m.save(AuditLog, {
        actorId: user.id,
        action: "BOOKING_CONFIRMED",
        resourceId: b.id,
      });
      return b;
    });
  }
  async list(user: User) {
    const q = db
      .getRepository(Booking)
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.business", "b")
      .leftJoinAndSelect("r.service", "s");
    if (user.role === "CLIENT") q.where("r.clientId=:id", { id: user.id });
    else if (user.role === "BUSINESS")
      q.where("b.ownerId=:id", { id: user.id }).leftJoinAndSelect(
        "r.client",
        "c",
      );
    else throw new ForbiddenException(coded("BOOKING_FORBIDDEN", "Forbidden"));
    const items = await q.orderBy("r.startAt", "DESC").take(1000).getMany();
    return items.map(({ business, client, service, ...r }) => ({
      ...r,
      // Keep the historical name; use a current translation only when its Spanish name still matches.
      serviceNameEn: r.serviceNameEn || (service?.name === r.serviceName ? service.nameEn : null),
      business: {
        id: business.id,
        name: business.name,
        address: business.address,
        phone: business.phone,
        cancellationMinutes: business.cancellationMinutes,
      },
      ...(client
        ? {
            client: {
              name: client.name,
              email: client.email,
              phone: client.phone,
            },
          }
        : {}),
    }));
  }
  async change(
    user: User,
    bookingId: string,
    status: Booking["status"],
    reason: string,
  ) {
    const initial = await db
      .getRepository(Booking)
      .findOne({ where: { id: bookingId }, relations: { business: true } });
    if (
      !initial ||
      !(
        (initial.clientId === user.id && user.role === "CLIENT") ||
        (initial.business.ownerId === user.id && user.role === "BUSINESS")
      )
    )
      throw new NotFoundException(coded("BOOKING_NOT_FOUND", "Reserva no encontrada."));
    return db.transaction("READ COMMITTED", async (m) => {
      await m.getRepository(User).findOne({
        where: { id: initial.clientId },
        lock: { mode: "pessimistic_write" },
      });
      const business = await m.getRepository(Business).findOne({
        where: { id: initial.businessId },
        lock: { mode: "pessimistic_write" },
      });
      const b = await m.getRepository(Booking).findOneOrFail({
        where: { id: bookingId },
        lock: { mode: "pessimistic_write" },
      });
      if (b.status === status) return b;
      if (b.status !== "CONFIRMED")
        throw new ConflictException(coded("BOOKING_INVALID_STATUS", "La reserva ya tiene un estado final."));
      if (status === "CANCELLED") {
        if (
          user.role === "CLIENT" &&
          b.startAt.getTime() - Date.now() <
            business!.cancellationMinutes * 60000
        )
          throw new ConflictException(
            coded("BOOKING_CANCELLATION_TOO_LATE", `Solo puedes cancelar con al menos ${business!.cancellationMinutes} minutos de anticipación.`),
          );
        if (b.startAt <= new Date())
          throw new ConflictException(
            coded("BOOKING_CANNOT_CANCEL", "No puedes cancelar una cita que ya comenzó."),
          );
        b.cancelledAt = new Date();
        b.cancellationReason = reason;
      } else {
        if (user.role !== "BUSINESS") throw new ForbiddenException(coded("BOOKING_FORBIDDEN", "Forbidden"));
        if (b.endAt > new Date())
          throw new ConflictException(
            coded("BOOKING_NOT_FINISHED", "Espera a que finalice el horario de la cita."),
          );
      }
      b.status = status;
      await m.save(b);
      if (status === "CANCELLED") await enqueueBooking(m, b, "cancelada");
      await m.save(AuditLog, {
        actorId: user.id,
        action: `BOOKING_${status}`,
        resourceId: b.id,
        detail: reason,
      });
      return b;
    });
  }
}
