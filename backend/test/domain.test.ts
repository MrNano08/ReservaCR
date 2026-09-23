import { test } from "node:test";
import assert from "node:assert/strict";
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
