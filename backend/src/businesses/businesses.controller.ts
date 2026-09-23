import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { AuthGuard, Roles, AuthRequest } from "../auth/guard";
import { BusinessesService } from "./businesses.service";
import { parse, id, idSchema, text } from "../common/validation";
import { config } from "../common/config";
import { db } from "../database/data-source";
import { Business, Category, AuditLog } from "../database/entities";
const profile = z
  .object({
    name: text(120, 2),
    description: text(2500, 10),
    categoryId: idSchema,
    province: z.enum([
      "Guanacaste",
      "San José",
      "Alajuela",
      "Cartago",
      "Heredia",
      "Puntarenas",
      "Limón",
    ]),
    canton: text(80, 2),
    address: text(300, 5),
    phone: text(25, 8),
    capacity: z.number().int().min(1).max(50),
    cancellationMinutes: z.number().int().min(0).max(10080),
  })
  .strict();
const service = z
  .object({
    name: text(100, 2),
    description: text(500, 0).default(""),
    duration: z.number().int().min(30).max(480).multipleOf(30),
    price: z.number().int().min(0).max(10000000).nullable(),
    active: z.boolean().default(true),
  })
  .strict();
@Controller()
export class BusinessesController {
  constructor(private readonly svc: BusinessesService) {}
  @Get("categories") categories() {
    return db
      .getRepository(Category)
      .find({ where: { active: true }, order: { name: "ASC" } });
  }
  @Get("businesses") catalog(@Query() query: unknown) {
    return this.svc.catalog(
      parse(
        z.object({
          q: text(100, 0).optional(),
          categoryId: idSchema.optional(),
          province: text(80).optional(),
          canton: text(80).optional(),
          page: z.coerce.number().int().min(1).max(10000).default(1),
        }),
        query,
      ),
    );
  }
  @Get("businesses/:id") detail(@Param("id") value: string) {
    return this.svc.detail(id(value));
  }
  @Get("owner/business") @UseGuards(AuthGuard) @Roles("BUSINESS") async mine(
    @Req() req: AuthRequest,
  ) {
    const b = await this.svc.owned(req.user);
    return this.svc.detail(b.id, false);
  }
  @Put("owner/business") @UseGuards(AuthGuard) @Roles("BUSINESS") save(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.svc.saveProfile(req.user, parse(profile, body));
  }
  @Post("owner/services")
  @UseGuards(AuthGuard)
  @Roles("BUSINESS")
  createService(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.svc.saveService(req.user, parse(service, body));
  }
  @Put("owner/services/:id")
  @UseGuards(AuthGuard)
  @Roles("BUSINESS")
  updateService(
    @Req() req: AuthRequest,
    @Param("id") value: string,
    @Body() body: unknown,
  ) {
    return this.svc.saveService(req.user, parse(service, body), id(value));
  }
  @Put("owner/hours") @UseGuards(AuthGuard) @Roles("BUSINESS") hours(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.svc.setHours(
      req.user,
      parse(
        z
          .array(
            z
              .object({
                weekday: z.number().int().min(0).max(6),
                startMinute: z.number().int().min(0).max(1410).multipleOf(30),
                endMinute: z.number().int().min(30).max(1440).multipleOf(30),
              })
              .strict(),
          )
          .max(28),
        body,
      ),
    );
  }
  @Patch("owner/publish") @UseGuards(AuthGuard) @Roles("BUSINESS") publish(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.svc.publish(
      req.user,
      parse(z.object({ published: z.boolean() }).strict(), body).published,
    );
  }
  @Post("owner/resubmit") @UseGuards(AuthGuard) @Roles("BUSINESS") resubmit(
    @Req() req: AuthRequest,
  ) {
    return this.svc.resubmit(req.user);
  }
  @Post("owner/blocks") @UseGuards(AuthGuard) @Roles("BUSINESS") block(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const d = parse(
      z
        .object({
          startAt: z.iso.datetime({ offset: true }),
          endAt: z.iso.datetime({ offset: true }),
          reason: text(200),
        })
        .strict(),
      body,
    );
    return this.svc.addBlock(req.user, {
      ...d,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
    });
  }
  @Delete("owner/blocks/:id") @UseGuards(AuthGuard) @Roles("BUSINESS") unblock(
    @Req() req: AuthRequest,
    @Param("id") value: string,
  ) {
    return this.svc.removeBlock(req.user, id(value));
  }
  @Post("owner/image")
  @UseGuards(AuthGuard)
  @Roles("BUSINESS")
  @UseInterceptors(
    FileInterceptor("image", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.svc.owned(req.user);
    if (
      !file ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    )
      throw new BadRequestException(
        "Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.",
      );
    let data: Buffer;
    try {
      data = await sharp(file.buffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize(1400, 900, { fit: "cover", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException("El archivo no es una imagen válida.");
    }
    const name = `${randomUUID()}.webp`;
    await mkdir(config.UPLOAD_DIR, { recursive: true });
    await writeFile(join(config.UPLOAD_DIR, name), data);
    return this.svc.saveProfile(req.user, { imageUrl: `/uploads/${name}` });
  }
  @Get("admin/businesses") @UseGuards(AuthGuard) @Roles("ADMIN") adminList() {
    return db.getRepository(Business).find({
      relations: { category: true },
      order: { createdAt: "DESC" },
      take: 500,
    });
  }
  @Get("admin/businesses/:id")
  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  adminDetail(@Param("id") value: string) {
    return this.svc.detail(id(value), false);
  }
  @Patch("admin/businesses/:id") @UseGuards(AuthGuard) @Roles("ADMIN") review(
    @Req() req: AuthRequest,
    @Param("id") value: string,
    @Body() body: unknown,
  ) {
    const d = parse(
      z
        .object({
          status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
          reviewNote: text(500, 0).default(""),
        })
        .strict()
        .refine((d) => d.status === "APPROVED" || d.reviewNote.length >= 5, {
          message: "Indica el motivo de rechazo o suspensión.",
        }),
      body,
    );
    return this.svc.review(req.user, id(value), d.status, d.reviewNote);
  }
  @Get("admin/categories")
  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  allCategories() {
    return db.getRepository(Category).find({ order: { name: "ASC" } });
  }
  @Post("admin/categories")
  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  async createCategory(@Req() req: AuthRequest, @Body() body: unknown) {
    const data = parse(z.object({ name: text(80, 2) }).strict(), body);
    return db.transaction(async (m) => {
      const c = await m.save(Category, data);
      await m.save(AuditLog, {
        actorId: req.user.id,
        action: "CATEGORY_CREATE",
        resourceId: c.id,
        detail: c.name,
      });
      return c;
    });
  }
  @Patch("admin/categories/:id")
  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  async editCategory(
    @Req() req: AuthRequest,
    @Param("id") value: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({ name: text(80, 2), active: z.boolean() }).strict(),
      body,
    );
    return db.transaction(async (m) => {
      await m.update(Category, id(value), data);
      await m.save(AuditLog, {
        actorId: req.user.id,
        action: "CATEGORY_UPDATE",
        resourceId: value,
        detail: data.name,
      });
      return { ok: true };
    });
  }
  @Get("admin/audit") @UseGuards(AuthGuard) @Roles("ADMIN") audit() {
    return db
      .getRepository(AuditLog)
      .find({ order: { createdAt: "DESC" }, take: 200 });
  }
}
