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
      })),
    });
  return result.data;
}
export const idSchema = z.string().uuid();
export const id = (value: string) => parse(idSchema, value);
export const text = (max: number, min = 1) =>
  z.string().max(max).trim().min(min);
export const email = z.string().max(190).trim().toLowerCase().email();
// Keep the user's formatting; validate only profile writes, never historical rows.
export const businessPhone = z.string().max(25).trim().refine(value => {
  if (!/^(?:\+506[ -]?)?\d{4}[ -]?\d{4}$/.test(value)) return false;
  const phone = parsePhoneNumberFromString(value, "CR");
  return phone?.country === "CR" && phone.isValid();
}, "Número de teléfono inválido.");
