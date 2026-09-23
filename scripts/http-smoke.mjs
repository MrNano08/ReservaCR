import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
const base = process.env.TEST_URL || "http://localhost:5173/api";
const password = process.env.SEED_PASSWORD;
assert.ok(password, "Define SEED_PASSWORD de las cuentas ficticias.");
let checks = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  checks++;
  console.log(`PASS ${message}`);
};
async function request(
  path,
  { cookie = "", method = "GET", body, headers = {} } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "ReservaCR",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
const login = async (email) => {
  const r = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  ok(r.status === 201, `ingreso ${email}`);
  return r.cookie;
};
const admin = await login("admin@reservacr.test"),
  owner = await login("negocio@reservacr.test"),
  client = await login("cliente@reservacr.test");
const catalog = await request("/businesses");
ok(
  catalog.status === 200 && catalog.data.items.length === 4,
  "catálogo publicado desde MariaDB",
);
ok(
  (await request("/admin/businesses", { cookie: client })).status === 403,
  "cliente no accede al panel administrativo",
);
ok(
  (await request("/bookings")).status === 401,
  "reservas privadas requieren sesión",
);
ok(
  (
    await request("/auth/register", {
      method: "POST",
      body: {
        name: "Escalada",
        email: `${randomUUID()}@example.test`,
        password,
        role: "ADMIN",
      },
    })
  ).status === 400,
  "registro rechaza escalada de rol",
);
ok(
  (
    await request("/auth/login", {
      method: "POST",
      headers: { Origin: "https://intruso.example" },
      body: { email: "cliente@reservacr.test", password },
    })
  ).status === 403,
  "origen ajeno rechazado",
);
const owned = await request("/owner/business", { cookie: owner });
ok(owned.status === 200, "propietario carga configuración propia");
const service = owned.data.services[0];
let availability;
for (let days = 4; days < 11; days++) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86400000));
  const result = await request(
    `/availability?serviceId=${service.id}&date=${date}`,
    { cookie: client },
  );
  if (result.data.slots?.length) {
    availability = result.data;
    break;
  }
}
assert.ok(availability);
const body = {
  serviceId: service.id,
  startAt: availability.slots[0].startAt,
  notes: "Prueba HTTP",
  idempotencyKey: randomUUID(),
};
const booking = await request("/bookings", {
  cookie: client,
  method: "POST",
  body,
});
ok(
  booking.status === 201 && booking.data.status === "CONFIRMED",
  "reserva HTTP persiste confirmada",
);
const retry = await request("/bookings", {
  cookie: client,
  method: "POST",
  body,
});
ok(retry.data.id === booking.data.id, "reintento HTTP devuelve la misma cita");
ok(
  (await request("/bookings", { cookie: owner })).data.some(
    (b) => b.id === booking.data.id,
  ),
  "reserva visible en agenda del negocio",
);
ok(
  (await request("/notifications", { cookie: client })).data.some((n) =>
    n.subject.includes(booking.data.code),
  ),
  "notificación interna creada",
);
const foreign = await login("barberia@reservacr.test");
ok(
  (
    await request(`/owner/services/${service.id}`, {
      cookie: foreign,
      method: "PUT",
      body: {
        name: "Cambio ajeno",
        description: "",
        duration: 30,
        price: null,
        active: true,
      },
    })
  ).status === 404,
  "no se modifica servicio ajeno",
);
ok(
  (
    await request(`/bookings/${booking.data.id}`, {
      cookie: foreign,
      method: "PATCH",
      body: { status: "CANCELLED", reason: "" },
    })
  ).status === 404,
  "no se cancela reserva ajena",
);
const cancel = await request(`/bookings/${booking.data.id}`, {
  cookie: client,
  method: "PATCH",
  body: { status: "CANCELLED", reason: "Cierre de prueba" },
});
ok(cancel.data.status === "CANCELLED", "cancelación HTTP aplicada");
const invalid = await fetch(base + "/owner/image", {
  method: "POST",
  headers: { Cookie: owner, "X-Requested-With": "ReservaCR" },
  body: (() => {
    const f = new FormData();
    f.set(
      "image",
      new Blob(["no soy imagen"], { type: "image/png" }),
      "fake.png",
    );
    return f;
  })(),
});
ok(invalid.status === 400, "imagen con contenido falso rechazada");
const png = await sharp({
  create: { width: 32, height: 32, channels: 3, background: "#c4f29a" },
})
  .png()
  .toBuffer();
const imageBody = new FormData();
imageBody.set("image", new Blob([png], { type: "image/png" }), "test.png");
const uploaded = await fetch(base + "/owner/image", {
  method: "POST",
  headers: { Cookie: owner, "X-Requested-With": "ReservaCR" },
  body: imageBody,
});
ok(uploaded.status === 201, "imagen válida se decodifica y guarda");
const imageResult = await uploaded.json();
ok(imageResult.imageUrl.endsWith(".webp"), "imagen se normaliza a WebP");
// Restore the fictitious business image after testing so the design uses its normal placeholder.
const {
  name,
  description,
  categoryId,
  province,
  canton,
  address,
  phone,
  capacity,
  cancellationMinutes,
} = owned.data;
await request("/owner/business", {
  cookie: owner,
  method: "PUT",
  body: {
    name,
    description,
    categoryId,
    province,
    canton,
    address,
    phone,
    capacity,
    cancellationMinutes,
  },
});
const logs = await request("/admin/audit", { cookie: admin });
ok(
  logs.data.some((a) => a.resourceId === booking.data.id),
  "auditoría registra la reserva",
);
const logout = await request("/auth/logout", {
  cookie: client,
  method: "POST",
});
ok(
  logout.status === 201 &&
    (await request("/auth/me", { cookie: client })).status === 401,
  "cerrar sesión revoca el token",
);
const newOwner = await request("/auth/register", {
  method: "POST",
  body: {
    name: "Propietario QA",
    email: `${randomUUID()}@example.test`,
    password,
    phone: "88888888",
    role: "BUSINESS",
  },
});
ok(newOwner.status === 201, "registro de propietario");
const newBusiness = await request("/owner/business", {
  cookie: newOwner.cookie,
  method: "PUT",
  body: {
    name: "Negocio QA",
    description: "Negocio creado para verificar el flujo de aprobación.",
    categoryId,
    province: "Guanacaste",
    canton: "Nicoya",
    address: "Centro de Nicoya",
    phone: "88888888",
    capacity: 1,
    cancellationMinutes: 120,
  },
});
ok(
  newBusiness.status === 200 && newBusiness.data.status === "PENDING",
  "negocio nuevo pendiente de aprobación",
);
ok(
  (
    await request("/owner/publish", {
      cookie: newOwner.cookie,
      method: "PATCH",
      body: { published: true },
    })
  ).status === 403,
  "no publica un negocio pendiente",
);
ok(
  (
    await request(`/admin/businesses/${newBusiness.data.id}`, {
      cookie: admin,
      method: "PATCH",
      body: { status: "APPROVED", reviewNote: "Revisado en QA" },
    })
  ).status === 200,
  "administrador aprueba negocio",
);
ok(
  (
    await request("/owner/publish", {
      cookie: newOwner.cookie,
      method: "PATCH",
      body: { published: true },
    })
  ).status === 400,
  "no publica sin servicios ni horarios",
);
ok(
  (
    await request("/owner/services", {
      cookie: newOwner.cookie,
      method: "POST",
      body: {
        name: "Servicio QA",
        description: "",
        duration: 30,
        price: null,
        active: true,
      },
    })
  ).status === 201,
  "propietario crea servicio",
);
ok(
  (
    await request("/owner/hours", {
      cookie: newOwner.cookie,
      method: "PUT",
      body: [{ weekday: 1, startMinute: 480, endMinute: 1080 }],
    })
  ).status === 200,
  "propietario configura horario",
);
ok(
  (
    await request("/owner/publish", {
      cookie: newOwner.cookie,
      method: "PATCH",
      body: { published: true },
    })
  ).status === 200,
  "publicación con configuración completa",
);
ok(
  (await request(`/businesses/${newBusiness.data.id}`)).status === 200,
  "negocio publicado disponible al público",
);
await request(`/admin/businesses/${newBusiness.data.id}`, {
  cookie: admin,
  method: "PATCH",
  body: { status: "SUSPENDED", reviewNote: "Fin de prueba QA" },
});
ok(
  (await request(`/businesses/${newBusiness.data.id}`)).status === 404,
  "suspensión retira el negocio del público",
);
console.log(`HTTP: ${checks} comprobaciones correctas.`);
