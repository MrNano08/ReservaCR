import { MigrationInterface, QueryRunner } from "typeorm";

export class UserLanguage1790000000002 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query("ALTER TABLE users ADD COLUMN language varchar(2) NOT NULL DEFAULT 'es', ADD CONSTRAINT users_language_allowed CHECK (BINARY language IN ('es', 'en'))");
  }

  async down(): Promise<void> {
    // Rolling back application code does not require deleting user preferences.
    throw new Error("La reversión de users.language requiere un plan explícito para preservar las preferencias.");
  }
}
