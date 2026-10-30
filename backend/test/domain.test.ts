import { test } from "node:test";
import assert from "node:assert/strict";
import "./i18n.test";
import {
  dateInCR,
  localInstant,
  weekday,
  validDay,
  overlaps,
  fitsCapacity,
} from "../src/common/time";
test("Costa Rica convierte medianoche a UTC sin depender de TZ del proceso", () => {
  assert.equal(
    localInstant("2026-10-05", 0).toISOString(),
    "2026-10-05T06:00:00.000Z",
  );
  assert.equal(dateInCR(new Date("2026-10-05T03:00:00Z")), "2026-10-04");
  assert.equal(weekday("2026-10-05"), 1);
});
test("rechaza fechas que JavaScript normalizaría silenciosamente", () => {
  assert.equal(validDay("2026-02-30"), false);
  assert.equal(validDay("2026-13-01"), false);
  assert.equal(validDay("2028-02-29"), true);
});
test("intervalos adyacentes no se superponen", () => {
  const d = (m: number) => localInstant("2026-10-05", m);
  assert.equal(overlaps(d(600), d(630), d(630), d(660)), false);
  assert.equal(overlaps(d(600), d(660), d(630), d(690)), true);
});
test("servicio de 60 minutos consume el segundo intervalo ocupado", () => {
  const d = (m: number) => localInstant("2026-10-05", m);
  assert.equal(
    fitsCapacity(d(600), d(660), 1, [{ startAt: d(630), endAt: d(660) }]),
    false,
  );
});
test("capacidad compartida se respeta durante toda la duración", () => {
  const d = (m: number) => localInstant("2026-10-05", m);
  const busy = [
    { startAt: d(600), endAt: d(630) },
    { startAt: d(630), endAt: d(660) },
  ];
  assert.equal(fitsCapacity(d(600), d(660), 2, busy), true);
  assert.equal(fitsCapacity(d(600), d(660), 1, busy), false);
});

// Pure schema regression tests: no database connection or persistence.
import { z } from "zod";
import { businessPhone, fullName, registrationPhone, securePassword, text, parse } from "../src/common/validation";
import { errorResponse } from "../src/common/errors";
test("registration name and phone enforce the public contract", () => {
  for (const value of ["Erick Mora", "María José Núñez", "Jean-Pierre Mora"])
    assert.equal(fullName.safeParse(value).success, true, value);
  for (const value of ["454566565", "1234", "@@@@", "   "])
    assert.equal(fullName.safeParse(value).success, false, value);
  for (const value of ["87026279", "8702 6279", "8702-6279", "+50687026279", "+506 8702 6279", "+14155552671", "18448724681", "1-844-872-4681"])
    assert.equal(registrationPhone.safeParse(value).success, true, value);
  for (const value of ["cderrtr55654", "abc123", "123", "00000000"])
    assert.equal(registrationPhone.safeParse(value).success, false, value);
  assert.throws(
    () => parse(z.object({ name: fullName, phone: registrationPhone }), { name: "454566565", phone: "cderrtr55654" }),
    (err: any) => err.status === 400 && err.response?.fieldErrors?.length === 2,
  );
});
test("new passwords enforce length and composition without restricting special characters", () => {
  for (const value of ["a", "Aa123456789", "123456", "password", "abcdefgh1234", " ".repeat(12)])
    assert.equal(securePassword.safeParse(value).success, false, value);
  for (const value of ["Reserva2026Segura!", "Aa1234567890", "Aa1" + "!".repeat(69)])
    assert.equal(securePassword.safeParse(value).success, true, String(value.length));
  assert.equal(securePassword.safeParse("Aa1" + "!".repeat(70)).success, false);
});
test("business phone validates CR formats and rejects invalid numbering", () => {
  for (const value of ["87026279", "8702 6279", "8702-6279", "+506 8702 6279"])
    assert.equal(parse(businessPhone, value), value);
  for (const value of ["abc123", "123", "1".repeat(26), "12345678", "00000000", "+1 2025550123", "87026279 ext 1", "8702letters6279"])
    assert.equal(businessPhone.safeParse(value).success, false, value);
  assert.throws(() => parse(z.object({ phone: businessPhone }), { phone: "abc123" }), e => {
    const response = errorResponse(e);
    assert.equal(response.statusCode, 400);
    assert.equal(response.code, "VALIDATION_ERROR");
    assert.deepEqual(response.fieldErrors, [{ field: "phone", message: "Número de teléfono inválido.", code: "INVALID_PHONE" }]);
    return true;
  });
});
test("text boundaries reject maximum + 1 including whitespace padding", () => {
  for (const max of [25, 80, 100, 120, 190, 200, 300, 500, 2500]) {
    assert.equal(parse(text(max), "a".repeat(max)).length, max);
    for (const value of ["a".repeat(max + 1), "a".repeat(max) + " ", " ".repeat(max + 1)]) {
      assert.throws(() => parse(z.object({ value: text(max) }), { value }), e => {
        const response = errorResponse(e);
        assert.equal(response.statusCode, 400);
        assert.equal(response.code, "VALIDATION_ERROR");
        assert.ok((response.fieldErrors as { code: string; max: number }[]).some(field => field.code === "MAX_LENGTH" && field.max === max));
        return true;
      });
    }
  }
});

import { BusinessesController } from "../src/businesses/businesses.controller";
import { BusinessesService } from "../src/businesses/businesses.service";
import { AuthRequest } from "../src/auth/guard";
test("API controllers reject oversized profile, service and catalog inputs before service calls", () => {
  let calls = 0;
  const svc = { saveProfile: (_user: unknown, data: unknown) => { calls++; return data; },
    saveService: (_user: unknown, data: unknown) => { calls++; return data; },
    catalog: (data: unknown) => { calls++; return data; } } as unknown as BusinessesService;
  const controller = new BusinessesController(svc);
  const req = { user: { id: "qa", role: "BUSINESS" } } as AuthRequest;
  const profile = { name: "Negocio", description: "Descripción válida", descriptionEn: "", categoryId: "11111111-1111-4111-8111-111111111111", province: "Guanacaste", canton: "Nicoya", address: "Dirección válida", phone: "87026279", capacity: 1, cancellationMinutes: 120 };
  const service = { name: "Servicio", nameEn: "", description: "", descriptionEn: "", duration: 60, price: 1000, active: true };
  function boundary(base: object, field: string, max: number, run: (data: unknown) => unknown) {
    run({ ...base, [field]: "a".repeat(max) });
    const before = calls;
    assert.throws(() => run({ ...base, [field]: "a".repeat(max + 1) }), e => errorResponse(e).statusCode === 400);
    assert.equal(calls, before);
  }
  for (const [field, max] of Object.entries({ name: 120, description: 2500, descriptionEn: 2500, canton: 80, address: 300 }))
    boundary(profile, field, max, data => controller.save(req, data));
  for (const [field, max] of Object.entries({ name: 100, nameEn: 100, description: 500, descriptionEn: 500 }))
    boundary(service, field, max, data => controller.createService(req, data));
  boundary({}, "q", 100, data => controller.catalog(data));
  const before = calls;
  for (const phone of ["abc123", "123", "1".repeat(26), "12345678"])
    assert.throws(() => controller.save(req, { ...profile, phone }), e => errorResponse(e).statusCode === 400);
  assert.equal(calls, before);
});

import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AuthService } from "../src/auth/auth.service";
import { Errors } from "../src/common/errors";
test("manual HTTP requests cannot bypass phone or length validation (isolated API)", async () => {
  // Only these real controllers/guards/filters are mounted. No AppModule, DB or workers.
  let writes = 0;
  @Module({ controllers: [BusinessesController], providers: [
    { provide: AuthService, useValue: { resolve: async () => ({ id: "qa", role: "BUSINESS" }) } },
    { provide: BusinessesService, useValue: {
      saveProfile: (_user: unknown, data: unknown) => { writes++; return data; },
      catalog: (data: unknown) => data,
    } },
  ] })
  class IsolatedApi {}
  const app = await NestFactory.create(IsolatedApi, { logger: false });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new Errors());
  try {
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    const profile = { name: "Negocio", description: "Descripción válida", categoryId: "11111111-1111-4111-8111-111111111111", province: "Guanacaste", canton: "Nicoya", address: "Dirección válida", phone: "87026279", capacity: 1, cancellationMinutes: 120 };
    for (const phone of ["87026279", "8702 6279", "8702-6279", "+506 8702 6279", "abc123", "123", "1".repeat(26), "12345678"]) {
      const response = await fetch(url + "/api/owner/business", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...profile, phone }) });
      const valid = ["87026279", "8702 6279", "8702-6279", "+506 8702 6279"].includes(phone);
      assert.equal(response.status, valid ? 200 : 400);
      const body = await response.json() as { code: string; statusCode: number; fieldErrors: { field: string }[] };
      if (!valid) { assert.equal(body.code, "VALIDATION_ERROR"); assert.equal(body.statusCode, 400); assert.equal(body.fieldErrors[0].field, "phone"); }
    }
    assert.equal(writes, 4);
    for (const length of [100, 101]) {
      const response = await fetch(url + "/api/businesses?q=" + "a".repeat(length));
      assert.equal(response.status, length === 100 ? 200 : 400);
    }
    const response = await fetch(url + "/api/owner/business", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...profile, descriptionEn: "a".repeat(2501) }) });
    assert.equal(response.status, 400);
    assert.equal(writes, 4);
  } finally { await app.close(); }
});

import { AuthController } from "../src/auth/auth.controller";
test("manual HTTP requests cannot bypass the new-password policy (isolated API)", async () => {
  let writes = 0;
  const auth = {
    register: async (data: object) => { writes++; return { token: "qa", user: data }; },
    resetPassword: async () => { writes++; return { ok: true }; },
  };
  @Module({ controllers: [AuthController], providers: [{ provide: AuthService, useValue: auth }] })
  class IsolatedAuthApi {}
  const app = await NestFactory.create(IsolatedAuthApi, { logger: false });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new Errors());
  try {
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    const register = (password: string) => fetch(url + "/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QA Reserva", email: "qa@example.test", password, phone: "", role: "CLIENT" }),
    });
    const reset = (password: string) => fetch(url + "/api/auth/reset-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "a".repeat(64), password }),
    });
    for (const password of ["a", "Aa123456789", "123456", "password", "abcdefgh1234"]) {
      assert.equal((await register(password)).status, 400, password);
      assert.equal((await reset(password)).status, 400, password);
    }
    assert.equal((await register("Reserva2026Segura!")).status, 201);
    assert.equal((await reset("Reserva2026Segura!")).status, 201);
    assert.equal(writes, 2);
  } finally { await app.close(); }
});
