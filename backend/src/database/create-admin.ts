import { hash } from "bcryptjs";
import { db } from "./data-source";
import { User } from "./entities";
import { z } from "zod";
(async () => {
  const env = z
    .object({
      ADMIN_EMAIL: z.email(),
      ADMIN_NAME: z.string().min(2),
      ADMIN_PASSWORD: z.string().min(12).max(72),
    })
    .parse(process.env);
  await db.initialize();
  if (
    await db
      .getRepository(User)
      .findOneBy({ email: env.ADMIN_EMAIL.toLowerCase() })
  )
    throw new Error("El correo ya existe. No se cambió su rol.");
  await db.getRepository(User).save({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL.toLowerCase(),
    role: "ADMIN",
    passwordHash: await hash(env.ADMIN_PASSWORD, 12),
  });
  await db.destroy();
  console.log("Administrador creado.");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
