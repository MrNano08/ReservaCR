import i18n from "./config";

// Keep legacy server messages intact unless they match a reviewed translation.
const legacyCodes: Record<string, string> = {
  "Correo o contraseña incorrectos.": "INVALID_CREDENTIALS",
  "El correo ya está registrado.": "EMAIL_REGISTERED",
  "El enlace venció o ya fue utilizado.": "RESET_EXPIRED",
};
export function errorMessage(message: string): string {
  const key = legacyCodes[message] ? `errors:${legacyCodes[message]}` : message;
  if ((key.startsWith("errors:") || key.startsWith("validation:") || key.startsWith("owner:errors.")) && i18n.exists(key))
    return i18n.t(key);
  return message;
}
export function errorKey(code: unknown, message: string): string {
  if (typeof code === "string" && /^[A-Z][A-Z0-9_]*$/.test(code) && i18n.exists(`errors:${code}`))
    return `errors:${code}`;
  return legacyCodes[message] ? `errors:${legacyCodes[message]}` : message;
}
