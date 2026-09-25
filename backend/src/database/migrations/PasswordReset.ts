import { MigrationInterface, QueryRunner } from "typeorm";
export class PasswordReset1790000000001 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE password_resets (id uuid PRIMARY KEY,userId uuid NOT NULL,tokenHash varchar(64) NOT NULL UNIQUE,expiresAt datetime NOT NULL,createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),INDEX reset_user(userId),FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(q: QueryRunner) { await q.query("DROP TABLE password_resets"); }
}
