import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
z.config(z.locales.es());
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: result.error.issues
        .map((x) => `${x.path.join(".")}: ${x.message}`)
        .join("; "),
      fieldErrors: result.error.issues.map(x => ({ field: x.path.join("."), message: x.message })),
    });
  return result.data;
}
export const idSchema = z.string().uuid();
export const id = (value: string) => parse(idSchema, value);
export const text = (max: number, min = 1) =>
  z.string().trim().min(min).max(max);
export const email = z.string().trim().toLowerCase().email().max(190);
