import { MigrationInterface, QueryRunner } from "typeorm";

export class BilingualContent1790000000003 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // MariaDB DDL commits implicitly. Verify every target before applying any DDL.
    for (const [table, column] of [
      ["businesses", "descriptionEn"], ["services", "nameEn"],
      ["services", "descriptionEn"], ["bookings", "serviceNameEn"], ["categories", "code"],
    ]) {
      if (await q.hasColumn(table, column))
        throw new Error(`Revisa la migración parcial antes de continuar: ${table}.${column}`);
    }
    await q.query("ALTER TABLE businesses ADD COLUMN descriptionEn text NULL");
    await q.query("ALTER TABLE services ADD COLUMN nameEn varchar(100) NULL, ADD COLUMN descriptionEn varchar(500) NULL");
    await q.query("ALTER TABLE bookings ADD COLUMN serviceNameEn varchar(100) NULL");
    await q.query("ALTER TABLE categories ADD COLUMN code varchar(32) NULL");
    // Adopt these diagnosed category IDs; never identify existing categories by their display text.
    await q.query("UPDATE categories SET code = ? WHERE id = ? AND code IS NULL", ["food", "92734b92-8e6f-46bf-b88d-486335b65b31"]);
    await q.query("UPDATE categories SET code = ? WHERE id = ? AND code IS NULL", ["clothing", "bdede3d5-1e16-46f9-9d2f-5cf25bd16449"]);
  }

  async down(): Promise<void> {
    throw new Error("Conserva las columnas bilingües al revertir código; su eliminación requiere un plan explícito y respaldo.");
  }
}
