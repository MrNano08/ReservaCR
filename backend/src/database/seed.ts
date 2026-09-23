import { hash } from "bcryptjs";
import { db } from "./data-source";
import { User, Category, Business, Service, OpeningHour } from "./entities";
(async () => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Los datos de demostración no se cargan en producción.");
  if (process.env.SEED_DEMO !== "true")
    throw new Error(
      "Define SEED_DEMO=true para confirmar que quieres datos ficticios.",
    );
  await db.initialize();
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10)
    throw new Error("Define SEED_PASSWORD de al menos 10 caracteres.");
  const passwordHash = await hash(password, 12);
  await db.transaction(async (m) => {
    const users = [
      ["Administración", "admin@reservacr.test", "ADMIN"],
      ["Ana Cliente", "cliente@reservacr.test", "CLIENT"],
      ["Estudio Nativa", "negocio@reservacr.test", "BUSINESS"],
      ["Barbería Central", "barberia@reservacr.test", "BUSINESS"],
      ["Clínica Vital", "salud@reservacr.test", "BUSINESS"],
      ["Pausa Spa", "spa@reservacr.test", "BUSINESS"],
    ] as const;
    for (const [name, email, role] of users)
      if (!(await m.findOneBy(User, { email })))
        await m.save(User, {
          name,
          email,
          role,
          passwordHash,
          phone: "8888-8888",
        });
    for (const name of [
      "Belleza",
      "Barbería",
      "Salud",
      "Bienestar",
      "Servicios profesionales",
    ])
      if (!(await m.findOneBy(Category, { name })))
        await m.save(Category, { name });
    const examples = [
      [
        "negocio@reservacr.test",
        "Estudio Nativa",
        "Belleza",
        "Nicoya",
        "Un espacio para renovar tu estilo. Cortes, color y cuidado personal con atención cercana.",
        "Corte y estilo",
        60,
        12000,
      ],
      [
        "barberia@reservacr.test",
        "Barbería Central",
        "Barbería",
        "Santa Cruz",
        "Cortes clásicos, nuevas tendencias y el cuidado que tu barba necesita.",
        "Corte de cabello",
        30,
        6000,
      ],
      [
        "salud@reservacr.test",
        "Clínica Vital",
        "Salud",
        "Liberia",
        "Atención profesional y un espacio tranquilo para cuidar de tu bienestar.",
        "Consulta general",
        60,
        25000,
      ],
      [
        "spa@reservacr.test",
        "Pausa Spa",
        "Bienestar",
        "Nicoya",
        "Baja el ritmo y regálate un momento. Masajes y experiencias de relajación.",
        "Masaje relajante",
        60,
        18000,
      ],
    ] as const;
    for (const [
      email,
      name,
      category,
      canton,
      description,
      service,
      duration,
      price,
    ] of examples) {
      const owner = await m.findOneByOrFail(User, { email });
      if (await m.findOneBy(Business, { ownerId: owner.id })) continue;
      const c = await m.findOneByOrFail(Category, { name: category });
      const b = await m.save(Business, {
        ownerId: owner.id,
        name,
        categoryId: c.id,
        province: "Guanacaste",
        canton,
        address: `Centro de ${canton}, Guanacaste`,
        phone: "8888-8888",
        description,
        status: "APPROVED",
        published: true,
        capacity: 2,
        cancellationMinutes: 120,
      });
      await m.save(Service, [
        {
          businessId: b.id,
          name: service,
          description: "Atención con cita previa.",
          duration,
          price,
        },
        {
          businessId: b.id,
          name: "Atención personalizada",
          description: "Consulta las opciones con nuestro equipo.",
          duration: 30,
          price: null,
        },
      ]);
      for (let weekday = 1; weekday <= 6; weekday++)
        await m.save(OpeningHour, {
          businessId: b.id,
          weekday,
          startMinute: 480,
          endMinute: 1080,
        });
    }
  });
  await db.destroy();
  console.log(
    "Datos ficticios creados. Usa SEED_PASSWORD para las cuentas @reservacr.test.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
