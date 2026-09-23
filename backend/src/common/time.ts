export const SLOT = 30;
export const TZ = "America/Costa_Rica";
export const overlaps = (a: Date, b: Date, c: Date, d: Date) => a < d && b > c;
export function dateInCR(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function localInstant(day: string, minute: number) {
  return new Date(new Date(`${day}T00:00:00-06:00`).getTime() + minute * 60000);
}
export function weekday(day: string) {
  return new Date(`${day}T12:00:00-06:00`).getUTCDay();
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !isNaN(Date.parse(`${day}T12:00:00Z`)) &&
    new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day
  );
}
export function fitsCapacity(
  start: Date,
  end: Date,
  capacity: number,
  bookings: { startAt: Date; endAt: Date }[],
) {
  for (let t = start.getTime(); t < end.getTime(); t += SLOT * 60000) {
    if (
      bookings.filter((b) =>
        overlaps(new Date(t), new Date(t + SLOT * 60000), b.startAt, b.endAt),
      ).length >= capacity
    )
      return false;
  }
  return true;
}
export function formatCR(date: Date) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: TZ,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}
