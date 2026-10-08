import i18n, { locale } from "../i18n/config";
export const money = (value: number | null, currency: "CRC" | "USD" = "CRC") =>
  value === null
    ? i18n.t("common:price.ask")
    : new Intl.NumberFormat(locale(), {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "CRC" ? 0 : 2,
      }).format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat(locale(), {
    timeZone: "America/Costa_Rica",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const time = (value: string) =>
  new Intl.DateTimeFormat(locale(), {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const number = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale(), options).format(value);
// Sunday-first numeric IDs remain unchanged; only their display labels vary.
export const weekdayName = (weekday: number) =>
  new Intl.DateTimeFormat(locale(), {
    timeZone: "America/Costa_Rica",
    weekday: "long",
  }).format(new Date(Date.UTC(2023, 0, 1 + weekday, 12)));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const minuteTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const provinces = [
  "Guanacaste",
  "San José",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Puntarenas",
  "Limón",
];
export const weekdays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export const labels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  SUSPENDED: "Suspendido",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  NO_SHOW: "No asistió",
  SENT: "Enviado",
  FAILED: "Fallido",
};
