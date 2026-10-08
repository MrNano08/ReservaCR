import i18n from "./config";
import type { Category } from "../types";

export const categoryCodes = ["food", "clothing", "beauty", "barber", "health", "wellness", "professional", "other"] as const;

/** English is optional; never translate proper names or replace the stored Spanish text. */
export function bilingualText(spanish: string, english?: string | null): string {
  return i18n.resolvedLanguage === "en" && english?.trim() ? english : spanish;
}

export function categoryLabel(category?: Pick<Category, "name" | "code">): string {
  if (!category) return "";
  const code = category.code;
  return code && categoryCodes.includes(code as typeof categoryCodes[number])
    ? i18n.t(`common:categories.${code}`)
    : category.name;
}
