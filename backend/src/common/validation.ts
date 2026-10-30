import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
z.config(z.locales.es());
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: result.error.issues
        .map((x) => `${x.path.join(".")}: ${x.message}`)
        .join("; "),
      fieldErrors: result.error.issues.map(x => ({
        field: x.path.join("."), message: x.message,
        ...(x.code === "too_big" && x.origin === "string"
          ? { code: "MAX_LENGTH", max: x.maximum } : {}),
        ...(x.code === "custom" && x.message === "Número de teléfono inválido."
          ? { code: "INVALID_PHONE" } : {}),
        ...(x.code === "custom" && x.message === "Nombre completo inválido."
          ? { code: "INVALID_FULL_NAME" } : {}),
      })),
    });
  return result.data;
}
export const idSchema = z.string().uuid();
export const id = (value: string) => parse(idSchema, value);
export const text = (max: number, min = 1) =>
  z.string().max(max).trim().min(min);
export const email = z.string().max(190).trim().toLowerCase().email();
export const securePassword = z.string().min(12).max(72)
  .regex(/[A-Z]/, "La contraseña debe incluir una mayúscula.")
  .regex(/[a-z]/, "La contraseña debe incluir una minúscula.")
  .regex(/[0-9]/, "La contraseña debe incluir un número.");
const fullNameCharacters = /^[\p{L}\p{M}\p{Zs}'’\p{Pd}]+$/u;
const phoneCharacters = /^[+\d\p{Zs}()\-]+$/u;
export const fullName = z.string().max(100).trim().refine(value =>
  fullNameCharacters.test(value) && (value.match(/\p{L}/gu)?.length ?? 0) >= 2,
"Nombre completo inválido.");
export const registrationPhone = z.string().max(25).trim().refine(value => {
  if (!value) return true;
  if (!phoneCharacters.test(value)) return false;
  const normalized = value.replace(/^00/, "+");
  const phone = parsePhoneNumberFromString(normalized, { defaultCountry: "CR", extract: false });
  if (phone?.isValid()) return true;
  if (!normalized.startsWith("+")) {
    const withPlus = parsePhoneNumberFromString("+" + normalized, { extract: false });
    if (withPlus?.isValid()) return true;
  }
  return false;
}, "Número de teléfono inválido.");
// Keep the user's formatting; validate only profile writes, never historical rows.
export const businessPhone = z.string().max(25).trim().refine(value => {
  if (!/^(?:\+506[ -]?)?\d{4}[ -]?\d{4}$/.test(value)) return false;
  const phone = parsePhoneNumberFromString(value, "CR");
  return phone?.country === "CR" && phone.isValid();
}, "Número de teléfono inválido.");
