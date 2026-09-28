import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
export type Role = "CLIENT" | "BUSINESS" | "ADMIN";
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ length: 100 }) name!: string;
  @Column({ length: 190, unique: true }) email!: string;
  @Column({ select: false, length: 100 }) passwordHash!: string;
  @Column({ type: "varchar", length: 20, default: "CLIENT" }) role!: Role;
  @Column({ length: 25, default: "" }) phone!: string;
  @Column({ default: true }) active!: boolean;
  @CreateDateColumn() createdAt!: Date;
}
@Entity("sessions")
export class Session {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ length: 64, unique: true }) tokenHash!: string;
  @Column() userId!: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" }) @JoinColumn() user!: User;
  @Column() expiresAt!: Date;
}
@Entity("password_resets")
export class PasswordReset {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() userId!: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" }) @JoinColumn() user!: User;
  @Column({ length: 64, unique: true }) tokenHash!: string;
  @Column() expiresAt!: Date;
  @CreateDateColumn() createdAt!: Date;
}
@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ length: 80, unique: true }) name!: string;
  @Column({ default: true }) active!: boolean;
}
@Entity("businesses")
export class Business {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ unique: true }) ownerId!: string;
  @ManyToOne(() => User) @JoinColumn() owner!: User;
  @Column() categoryId!: string;
  @ManyToOne(() => Category) @JoinColumn() category!: Category;
  @Column({ length: 120 }) name!: string;
  @Column({ type: "text" }) description!: string;
  @Column({ length: 80 }) province!: string;
  @Column({ length: 80 }) canton!: string;
  @Column({ length: 300 }) address!: string;
  @Column({ length: 25 }) phone!: string;
  @Column({ length: 255, default: "" }) imageUrl!: string;
  @Column({ type: "varchar", length: 20, default: "PENDING" }) status!:
    "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  @Column({ length: 500, default: "" }) reviewNote!: string;
  @Column({ default: false }) published!: boolean;
  @Column({ type: "int", default: 1 }) capacity!: number;
  @Column({ type: "int", default: 120 }) cancellationMinutes!: number;
  @CreateDateColumn() createdAt!: Date;
}
@Entity("services")
export class Service {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index() @Column() businessId!: string;
  @ManyToOne(() => Business) @JoinColumn() business!: Business;
  @Column({ length: 100 }) name!: string;
  @Column({ length: 500, default: "" }) description!: string;
  @Column({ type: "int" }) duration!: number;
  @Column({ type: "int", nullable: true }) price!: number | null;
  @Column({ default: true }) active!: boolean;
}
@Entity("opening_hours")
@Index(["businessId", "weekday", "startMinute"], { unique: true })
export class OpeningHour {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() businessId!: string;
  @ManyToOne(() => Business) @JoinColumn() business!: Business;
  @Column({ type: "int" }) weekday!: number;
  @Column({ type: "int" }) startMinute!: number;
  @Column({ type: "int" }) endMinute!: number;
}
@Entity("blocks")
export class Block {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index() @Column() businessId!: string;
  @ManyToOne(() => Business) @JoinColumn() business!: Business;
  @Column() startAt!: Date;
  @Column() endAt!: Date;
  @Column({ length: 200 }) reason!: string;
}
@Entity("bookings")
@Index(["businessId", "status", "startAt"])
@Index(["clientId", "status", "startAt"])
@Index(["clientId", "idempotencyKey"], { unique: true })
export class Booking {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ length: 20, unique: true }) code!: string;
  @Column() clientId!: string;
  @ManyToOne(() => User) @JoinColumn() client!: User;
  @Column() businessId!: string;
  @ManyToOne(() => Business) @JoinColumn() business!: Business;
  @Column() serviceId!: string;
  @ManyToOne(() => Service) @JoinColumn() service!: Service;
  @Column({ length: 100 }) serviceName!: string;
  @Column({ type: "int", nullable: true }) price!: number | null;
  @Column() startAt!: Date;
  @Column() endAt!: Date;
  @Column({ type: "varchar", length: 20, default: "CONFIRMED" }) status!:
    "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  @Column({ length: 64 }) idempotencyKey!: string;
  @Column({ length: 500, default: "" }) notes!: string;
  @Column({ length: 300, default: "" }) cancellationReason!: string;
  @Column({ type: "datetime", nullable: true }) cancelledAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
}
@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index() @Column() userId!: string;
  @ManyToOne(() => User) @JoinColumn() user!: User;
  @Column({ length: 190 }) email!: string;
  @Column({ length: 160 }) subject!: string;
  @Column({ type: "text" }) body!: string;
  @Column({ type: "varchar", length: 20, default: "PENDING" }) status!:
    "PENDING" | "SENT" | "FAILED";
  @Column({ type: "int", default: 0 }) attempts!: number;
  @Column() nextAttemptAt!: Date;
  @Column({ default: false }) read!: boolean;
  @CreateDateColumn() createdAt!: Date;
}
@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() actorId!: string;
  @Column({ length: 80 }) action!: string;
  @Column({ length: 80 }) resourceId!: string;
  @Column({ length: 500, default: "" }) detail!: string;
  @CreateDateColumn() createdAt!: Date;
}
export const entities = [
  User,
  Session,
  PasswordReset,
  Category,
  Business,
  Service,
  OpeningHour,
  Block,
  Booking,
  Notification,
  AuditLog,
];
