import { coded } from "../common/errors";
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { db } from "../database/data-source";
import {
  Business,
  Service,
  OpeningHour,
  Block,
  User,
  Category,
  Booking,
  AuditLog,
} from "../database/entities";
import { overlaps, localInstant, dateInCR, weekday } from "../common/time";
@Injectable()
export class BusinessesService {
  async owned(user: User, manager: EntityManager = db.manager, lock = false) {
    const q = manager
      .getRepository(Business)
      .createQueryBuilder("b")
      .where("b.ownerId=:id", { id: user.id });
    if (lock) q.setLock("pessimistic_write");
    const b = await q.getOne();
    if (!b) throw new NotFoundException(coded("OWNER_BUSINESS_NOT_FOUND", "Primero registra tu negocio."));
    return b;
  }
  async detail(id: string, publicOnly = true) {
    const b = await db
      .getRepository(Business)
      .findOne({ where: { id }, relations: { category: true } });
    if (!b || (publicOnly && (!b.published || b.status !== "APPROVED")))
      throw new NotFoundException(coded("BUSINESS_NOT_FOUND", "El negocio no está disponible."));
    const [services, hours, blocks] = await Promise.all([
      db.getRepository(Service).find({
        where: { businessId: id, ...(publicOnly ? { active: true } : {}) },
        order: { name: "ASC" },
      }),
      db.getRepository(OpeningHour).find({
        where: { businessId: id },
        order: { weekday: "ASC", startMinute: "ASC" },
      }),
      db
        .getRepository(Block)
        .find({ where: { businessId: id }, order: { startAt: "ASC" } }),
    ]);
    const { ownerId, reviewNote, ...safe } = b;
    return {
      ...safe,
      ...(!publicOnly ? { ownerId, reviewNote } : {}),
      services,
      hours,
      blocks: publicOnly
        ? blocks.map(({ startAt, endAt }) => ({ startAt, endAt }))
        : blocks,
    };
  }
  async catalog(query: {
    q?: string;
    categoryId?: string;
    province?: string;
    canton?: string;
    page: number;
  }) {
    const q = db
      .getRepository(Business)
      .createQueryBuilder("b")
      .leftJoinAndSelect("b.category", "c")
      .where("b.status=:s AND b.published=true", { s: "APPROVED" });
    if (query.q)
      q.andWhere(
        "(b.name LIKE :q OR b.description LIKE :q OR b.canton LIKE :q)",
        { q: `%${query.q}%` },
      );
    if (query.categoryId)
      q.andWhere("b.categoryId=:categoryId", { categoryId: query.categoryId });
    if (query.province)
      q.andWhere("b.province=:province", { province: query.province });
    if (query.canton)
      q.andWhere("b.canton LIKE :canton", { canton: `%${query.canton}%` });
    const [items, total] = await q
      .orderBy("b.name", "ASC")
      .skip((query.page - 1) * 12)
      .take(12)
      .getManyAndCount();
    return {
      items: items.map(({ ownerId, reviewNote, ...rest }) => rest),
      total,
      page: query.page,
      pages: Math.ceil(total / 12),
    };
  }
  async saveProfile(user: User, data: Partial<Business>) {
    return db.transaction(async (m) => {
      // Lock the owner first so concurrent initial profile requests cannot create two businesses.
      await m.getRepository(User).findOne({
        where: { id: user.id },
        lock: { mode: "pessimistic_write" },
      });
      let b = await m.getRepository(Business).findOne({
        where: { ownerId: user.id },
        lock: { mode: "pessimistic_write" },
      });
      if (
        data.categoryId &&
        !(await m
          .getRepository(Category)
          .findOneBy({ id: data.categoryId, active: true }))
      )
        throw new BadRequestException(coded("BUSINESS_CATEGORY_INVALID", "Selecciona una categoría activa."));
      if (
        b &&
        data.capacity !== undefined &&
        data.capacity < b.capacity &&
        (await m
          .getRepository(Booking)
          .createQueryBuilder("r")
          .where("r.businessId=:id AND r.status=:s AND r.endAt>:now", {
            id: b.id,
            s: "CONFIRMED",
            now: new Date(),
          })
          .getCount())
      )
        throw new ConflictException(
          coded("OWNER_CAPACITY_CONFLICT", "No reduzcas los cupos mientras existan reservas futuras."),
        );
      b = m
        .getRepository(Business)
        .merge(
          b || m.getRepository(Business).create({ ownerId: user.id }),
          data,
        );
      return m.save(b);
    });
  }
  async saveService(user: User, data: Partial<Service>, serviceId?: string) {
    return db.transaction(async (m) => {
      const b = await this.owned(user, m, true);
      let s = serviceId
        ? await m
            .getRepository(Service)
            .findOneBy({ id: serviceId, businessId: b.id })
        : m.getRepository(Service).create({ businessId: b.id });
      if (!s) throw new NotFoundException(coded("OWNER_SERVICE_NOT_FOUND", "Servicio no encontrado."));
      s = m.getRepository(Service).merge(s, data);
      await m.save(s);
      if (
        !(await m
          .getRepository(Service)
          .countBy({ businessId: b.id, active: true }))
      )
        await m.update(Business, b.id, { published: false });
      return s;
    });
  }
  async setHours(user: User, hours: Partial<OpeningHour>[]) {
    return db.transaction(async (m) => {
      const b = await this.owned(user, m, true);
      for (const h of hours) {
        if (h.startMinute! >= h.endMinute!)
          throw new BadRequestException(
            coded("OWNER_INVALID_SCHEDULE", "La apertura debe ser anterior al cierre."),
          );
        if (
          hours.some(
            (x) =>
              x !== h &&
              x.weekday === h.weekday &&
              x.startMinute! < h.endMinute! &&
              x.endMinute! > h.startMinute!,
          )
        )
          throw new BadRequestException(
            coded("OWNER_SCHEDULE_OVERLAP", "Los horarios del mismo día no pueden superponerse."),
          );
      }
      const future = await m
        .getRepository(Booking)
        .createQueryBuilder("r")
        .where("r.businessId=:id AND r.status=:s AND r.endAt>:now", {
          id: b.id,
          s: "CONFIRMED",
          now: new Date(),
        })
        .getMany();
      if (
        future.some(
          (r) =>
            !hours.some(
              (h) =>
                h.weekday === weekday(dateInCR(r.startAt)) &&
                r.startAt >=
                  localInstant(dateInCR(r.startAt), h.startMinute!) &&
                r.endAt <= localInstant(dateInCR(r.startAt), h.endMinute!),
            ),
        )
      )
        throw new ConflictException(
          coded("OWNER_SCHEDULE_CONFLICT", "El nuevo horario dejaría reservas vigentes fuera de atención."),
        );
      await m.delete(OpeningHour, { businessId: b.id });
      if (hours.length)
        await m.save(
          OpeningHour,
          hours.map((h) => ({ ...h, businessId: b.id })),
        );
      else await m.update(Business, b.id, { published: false });
      return { ok: true };
    });
  }
  async publish(user: User, published: boolean) {
    return db.transaction(async (m) => {
      const b = await this.owned(user, m, true);
      if (published) {
        if (b.status !== "APPROVED")
          throw new ForbiddenException(coded("BUSINESS_NOT_APPROVED", "El negocio debe estar aprobado."));
        if (
          !(await m
            .getRepository(Service)
            .countBy({ businessId: b.id, active: true })) ||
          !(await m.getRepository(OpeningHour).countBy({ businessId: b.id }))
        )
          throw new BadRequestException(
            coded("BUSINESS_CONFIGURATION_REQUIRED", "Configura al menos un servicio activo y un horario."),
          );
      }
      b.published = published;
      return m.save(b);
    });
  }
  async resubmit(user: User) {
    return db.transaction(async (m) => {
      const b = await this.owned(user, m, true);
      if (b.status !== "REJECTED")
        throw new ConflictException(
          coded("BUSINESS_REVIEW_NOT_ALLOWED", "Solo un negocio rechazado puede volver a solicitar revisión."),
        );
      b.status = "PENDING";
      b.published = false;
      return m.save(b);
    });
  }
  async addBlock(
    user: User,
    data: { startAt: Date; endAt: Date; reason: string },
  ) {
    return db.transaction(async (m) => {
      const b = await this.owned(user, m, true);
      if (data.startAt >= data.endAt || data.endAt <= new Date())
        throw new BadRequestException(
          coded("OWNER_INVALID_BLOCK_RANGE", "El bloqueo debe tener un rango válido y futuro."),
        );
      const count = await m
        .getRepository(Booking)
        .createQueryBuilder("r")
        .where(
          "r.businessId=:id AND r.status=:s AND r.startAt<:end AND r.endAt>:start",
          { id: b.id, s: "CONFIRMED", start: data.startAt, end: data.endAt },
        )
        .getCount();
      if (count)
        throw new ConflictException(
          coded("OWNER_BLOCK_CONFLICT", "Hay reservas en ese rango. Cancélalas antes de bloquearlo."),
        );
      return m.save(Block, { ...data, businessId: b.id });
    });
  }
  async removeBlock(user: User, id: string) {
    return db.transaction(async (m) => {
      const b = await this.owned(user, m, true);
      const result = await m.delete(Block, { id, businessId: b.id });
      if (!result.affected)
        throw new NotFoundException(coded("OWNER_BLOCK_NOT_FOUND", "Bloqueo no encontrado."));
      return { ok: true };
    });
  }
  async review(
    user: User,
    id: string,
    status: Business["status"],
    reviewNote: string,
  ) {
    return db.transaction(async (m) => {
      const b = await m
        .getRepository(Business)
        .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
      if (!b) throw new NotFoundException(coded("BUSINESS_NOT_FOUND", "Not Found"));
      b.status = status;
      b.reviewNote = reviewNote;
      if (status !== "APPROVED") b.published = false;
      await m.save(b);
      await m.save(AuditLog, {
        actorId: user.id,
        resourceId: id,
        action: `BUSINESS_${status}`,
        detail: reviewNote,
      });
      return b;
    });
  }
}
