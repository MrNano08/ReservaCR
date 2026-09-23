import { MigrationInterface, QueryRunner } from "typeorm";
export class Initial1790000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const tables = [
      `CREATE TABLE users (id varchar(36) PRIMARY KEY,name varchar(100) NOT NULL,email varchar(190) NOT NULL UNIQUE,passwordHash varchar(100) NOT NULL,role varchar(20) NOT NULL DEFAULT 'CLIENT',phone varchar(25) NOT NULL DEFAULT '',active tinyint NOT NULL DEFAULT 1,createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6))`,
      `CREATE TABLE sessions (id varchar(36) PRIMARY KEY,tokenHash varchar(64) NOT NULL UNIQUE,userId varchar(36) NOT NULL,expiresAt datetime NOT NULL,FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE)`,
      `CREATE TABLE categories (id varchar(36) PRIMARY KEY,name varchar(80) NOT NULL UNIQUE,active tinyint NOT NULL DEFAULT 1)`,
      `CREATE TABLE businesses (id varchar(36) PRIMARY KEY,ownerId varchar(36) NOT NULL UNIQUE,categoryId varchar(36) NOT NULL,name varchar(120) NOT NULL,description text NOT NULL,province varchar(80) NOT NULL,canton varchar(80) NOT NULL,address varchar(300) NOT NULL,phone varchar(25) NOT NULL,imageUrl varchar(255) NOT NULL DEFAULT '',status varchar(20) NOT NULL DEFAULT 'PENDING',reviewNote varchar(500) NOT NULL DEFAULT '',published tinyint NOT NULL DEFAULT 0,capacity int NOT NULL DEFAULT 1,cancellationMinutes int NOT NULL DEFAULT 120,createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),FOREIGN KEY(ownerId) REFERENCES users(id),FOREIGN KEY(categoryId) REFERENCES categories(id))`,
      `CREATE TABLE services (id varchar(36) PRIMARY KEY,businessId varchar(36) NOT NULL,name varchar(100) NOT NULL,description varchar(500) NOT NULL DEFAULT '',duration int NOT NULL,price int NULL,active tinyint NOT NULL DEFAULT 1,FOREIGN KEY(businessId) REFERENCES businesses(id))`,
      `CREATE TABLE opening_hours (id varchar(36) PRIMARY KEY,businessId varchar(36) NOT NULL,weekday int NOT NULL,startMinute int NOT NULL,endMinute int NOT NULL,UNIQUE KEY hours_unique(businessId,weekday,startMinute),FOREIGN KEY(businessId) REFERENCES businesses(id))`,
      `CREATE TABLE blocks (id varchar(36) PRIMARY KEY,businessId varchar(36) NOT NULL,startAt datetime NOT NULL,endAt datetime NOT NULL,reason varchar(200) NOT NULL,FOREIGN KEY(businessId) REFERENCES businesses(id))`,
      `CREATE TABLE bookings (id varchar(36) PRIMARY KEY,code varchar(20) NOT NULL UNIQUE,clientId varchar(36) NOT NULL,businessId varchar(36) NOT NULL,serviceId varchar(36) NOT NULL,serviceName varchar(100) NOT NULL,price int NULL,startAt datetime NOT NULL,endAt datetime NOT NULL,status varchar(20) NOT NULL DEFAULT 'CONFIRMED',idempotencyKey varchar(64) NOT NULL,notes varchar(500) NOT NULL DEFAULT '',cancellationReason varchar(300) NOT NULL DEFAULT '',cancelledAt datetime NULL,createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),UNIQUE KEY booking_idempotency(clientId,idempotencyKey),INDEX business_time(businessId,status,startAt),INDEX client_time(clientId,status,startAt),FOREIGN KEY(clientId) REFERENCES users(id),FOREIGN KEY(businessId) REFERENCES businesses(id),FOREIGN KEY(serviceId) REFERENCES services(id))`,
      `CREATE TABLE notifications (id varchar(36) PRIMARY KEY,userId varchar(36) NOT NULL,email varchar(190) NOT NULL,subject varchar(160) NOT NULL,body text NOT NULL,status varchar(20) NOT NULL DEFAULT 'PENDING',attempts int NOT NULL DEFAULT 0,nextAttemptAt datetime NOT NULL,\`read\` tinyint NOT NULL DEFAULT 0,createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),INDEX notification_pending(status,nextAttemptAt),FOREIGN KEY(userId) REFERENCES users(id))`,
      `CREATE TABLE audit_logs (id varchar(36) PRIMARY KEY,actorId varchar(36) NOT NULL,action varchar(80) NOT NULL,resourceId varchar(80) NOT NULL,detail varchar(500) NOT NULL DEFAULT '',createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6))`,
    ];
    for (const sql of tables)
      await q.query(
        sql +
          " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
      );
  }
  async down(q: QueryRunner) {
    for (const table of [
      "audit_logs",
      "notifications",
      "bookings",
      "blocks",
      "opening_hours",
      "services",
      "businesses",
      "categories",
      "sessions",
      "users",
    ])
      await q.query(`DROP TABLE \`${table}\``);
  }
}
