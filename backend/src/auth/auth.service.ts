import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { MoreThan } from "typeorm";
import { db } from "../database/data-source";
import { User, Session, Role } from "../database/entities";
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const safeUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
});
@Injectable()
export class AuthService {
  async register(data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: Role;
  }) {
    const repo = db.getRepository(User);
    const user = repo.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      passwordHash: await hash(data.password, 12),
    });
    try {
      await repo.save(user);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY")
        throw new ConflictException("El correo ya está registrado.");
      throw e;
    }
    return this.session(user);
  }
  async login(email: string, password: string) {
    const user = await db
      .getRepository(User)
      .createQueryBuilder("u")
      .addSelect("u.passwordHash")
      .where("u.email=:email", { email })
      .getOne();
    const valid = await compare(
      password,
      user?.passwordHash ||
        "$2b$12$7Xx45VkVeWGvuWrNXVDKJuuafCCZBCpHzBCDK.iFRPi1AJwdOgZeW",
    );
    if (!user || !valid || !user.active)
      throw new UnauthorizedException("Correo o contraseña incorrectos.");
    return this.session(user);
  }
  async session(user: User) {
    const token = randomBytes(32).toString("hex");
    await db.getRepository(Session).save({
      userId: user.id,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    return { user: safeUser(user), token };
  }
  async resolve(token?: string) {
    if (!token || token.length !== 64) return null;
    const s = await db.getRepository(Session).findOne({
      where: { tokenHash: digest(token), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    return s?.user.active ? s.user : null;
  }
  async logout(token?: string) {
    if (token)
      await db.getRepository(Session).delete({ tokenHash: digest(token) });
  }
}
