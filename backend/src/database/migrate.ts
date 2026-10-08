import { db } from "./data-source";
(async () => {
  await db.initialize();
  try {
    const runner = db.createQueryRunner();
    try {
      if (await runner.hasTable("users")) {
        const history = await runner.hasTable("migrations")
          ? await runner.query("SELECT name FROM migrations WHERE name = ?", ["Initial1790000000000"])
          : [];
        if (!history.length)
          throw new Error("El esquema existente no registra la migración inicial. Reconcilia el historial con el esquema y un respaldo antes de migrar; no se aplicaron cambios.");
      }
    } finally {
      await runner.release();
    }
    await db.runMigrations({ transaction: "none" });
    console.log("Migraciones aplicadas.");
  } finally {
    await db.destroy();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
