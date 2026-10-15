import i18n from "./config";

// Keep legacy server messages intact unless they match a reviewed translation.
const legacyCodes: Record<string, string> = {
  "Correo o contraseña incorrectos.": "INVALID_CREDENTIALS",
  "El correo ya está registrado.": "EMAIL_REGISTERED",
  "El enlace venció o ya fue utilizado.": "RESET_EXPIRED",
};
export function errorMessage(message: string): string {
  const limit = /^validation:maxLength:(\d+)$/.exec(message);
  if (limit) return i18n.t("validation:maxLength", { max: Number(limit[1]) });
  const key = legacyCodes[message] ? `errors:${legacyCodes[message]}` : message;
  if ((key.startsWith("errors:") || key.startsWith("validation:") || key.startsWith("owner:errors.")) && i18n.exists(key))
    return i18n.t(key);
  return message;
}
export function errorKey(code: unknown, message: string, fieldErrors?: unknown): string {
  if (code === "VALIDATION_ERROR" && Array.isArray(fieldErrors)) {
    if (fieldErrors.some(field => field?.code === "INVALID_PHONE")) return "validation:invalidPhone";
    const limit = fieldErrors.find(field => field?.code === "MAX_LENGTH" && Number.isSafeInteger(field.max));
    if (limit) return `validation:maxLength:${limit.max}`;
  }
  if (typeof code === "string" && /^[A-Z][A-Z0-9_]*$/.test(code) && i18n.exists(`errors:${code}`))
    return `errors:${code}`;
  return legacyCodes[message] ? `errors:${legacyCodes[message]}` : message;
}
