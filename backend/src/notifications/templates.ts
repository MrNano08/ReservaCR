import { languageOf } from "../common/language";

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

const copy = {
  es: {
    resetSubject: "Recuperar contraseña · ReservaCR",
    resetBody: "Solicitaste cambiar tu contraseña en ReservaCR. Abre este enlace en los próximos 30 minutos:",
    resetIgnore: "Si no solicitaste el cambio, ignora este mensaje.",
    createdClient: "Reserva confirmada", createdOwner: "Reserva confirmada",
    cancelledClient: "Reserva cancelada", cancelledOwner: "Reserva cancelada",
    code: "Código", status: "Estado", confirmed: "confirmada", cancelled: "cancelada",
    reason: "Motivo", details: "Consulta los detalles en",
  },
  en: {
    resetSubject: "Reset password · ReservaCR",
    resetBody: "You requested a password change in ReservaCR. Open this link within the next 30 minutes:",
    resetIgnore: "If you did not request this change, ignore this message.",
    createdClient: "Booking confirmed", createdOwner: "Booking confirmed",
    cancelledClient: "Booking cancelled", cancelledOwner: "Booking cancelled",
    code: "Code", status: "Status", confirmed: "confirmed", cancelled: "cancelled",
    reason: "Reason", details: "View the details at",
  },
};

// Render the persisted presentation verbatim. No parsing of labels or lookup of
// mutable booking data: retries and historical jobs keep their original text.
export function messageHtml(subject: string, body: string, link?: string, language?: unknown) {
  const safeLink = link && /^https?:\/\//i.test(link) ? escapeHtml(link) : undefined;
  return `<!doctype html><html${language === undefined ? "" : ` lang="${languageOf(language)}"`}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 12px;background:#101713;font-family:Arial,Helvetica,sans-serif;color:#edf1eb;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;"><tr><td style="background:#18221c;border:1px solid #2c3a30;border-radius:18px;padding:32px;overflow-wrap:anywhere;word-break:break-word;">
<p style="color:#c4f29a;font-size:22px;font-weight:bold;">ReservaCR</p>
<h1 style="font-size:28px;">${escapeHtml(subject)}</h1>
<p style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(body)}</p>
${safeLink ? `<p><a href="${safeLink}" style="color:#c4f29a;word-break:break-all;">${safeLink}</a></p>` : ""}
</td></tr></table></body></html>`;
}

export function passwordResetMessage(language: unknown, link: string) {
  const c = copy[languageOf(language)];
  const text = `${c.resetBody}\n${link}\n\n${c.resetIgnore}`;
  return { subject: c.resetSubject, text, html: messageHtml(c.resetSubject, text, link, languageOf(language)) };
}

export interface BookingMessageData {
  serviceName: string;
  businessName: string;
  startAt: Date;
  code: string;
  cancellationReason: string;
  link: string;
}

export function bookingMessage(language: unknown, kind: "confirmada" | "cancelada", recipient: "client" | "owner", data: BookingMessageData) {
  const lang = languageOf(language), c = copy[lang];
  const cancelled = kind === "cancelada";
  const title = cancelled
    ? (recipient === "client" ? c.cancelledClient : c.cancelledOwner)
    : (recipient === "client" ? c.createdClient : c.createdOwner);
  const date = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-CR", {
    timeZone: "America/Costa_Rica", dateStyle: "full", timeStyle: "short",
  }).format(data.startAt);
  const subject = `${title} · ${data.code}`;
  const body = `${data.serviceName}\n${data.businessName}\n${date}\n${c.code}: ${data.code}\n${c.status}: ${cancelled ? c.cancelled : c.confirmed}${data.cancellationReason ? `\n${c.reason}: ${data.cancellationReason}` : ""}\n${c.details} ${data.link}`;
  return { subject, body };
}
