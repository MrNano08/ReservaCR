import { db } from "./data-source";
(async () => {
  await db.initialize();
  await db.runMigrations({ transaction: "none" });
  console.log("Migraciones aplicadas.");
  await db.destroy();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
