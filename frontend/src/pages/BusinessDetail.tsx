import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, Phone, Clock3, CheckCircle2, ArrowLeft } from "lucide-react";
import { useLoad } from "../hooks/useLoad";
import { useAuth } from "../hooks/useAuth";
import { Business } from "../types";
import { api, send } from "../services/api";
import { bilingualText, categoryLabel } from "../i18n/content";
import { BusinessArt, ErrorBox, Loading, Field, Empty } from "../components/UI";
import {
  money,
  time,
  dateTime,
  today,
  weekdays,
  weekdayName,
  minuteTime,
} from "../utils/format";
export default function BusinessDetail() {
  const { t } = useTranslation("business");
  const { id } = useParams();
  const { data: b, loading, error } = useLoad<Business>(`/businesses/${id}`);
  const { user } = useAuth();
  const [serviceId, setService] = useState(""),
    [date, setDate] = useState(today()),
    [slot, setSlot] = useState(""),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [success, setSuccess] = useState<{ code: string; startAt: string } | null>(
      null,
    );
  const key = useRef(crypto.randomUUID());
  const availability = useLoad<{
    slots: { startAt: string; endAt: string; remaining: number }[];
  }>(serviceId ? `/availability?serviceId=${serviceId}&date=${date}` : null);
  useEffect(() => {
    setSlot("");
    key.current = crypto.randomUUID();
    setSuccess(null);
  }, [serviceId, date]);
  const selected = b?.services.find((s) => s.id === serviceId);
  if (loading) return <Loading />;
  if (!b) return <ErrorBox message={error} />;
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        {t("business:actions.back")}
      </Link>
      <div className="detail-grid">
        <section>
          <BusinessArt business={b} large />
          <div className="page-head">
            <span className="eyebrow">{categoryLabel(b.category)}</span>
            <h1>{b.name}</h1>
            <p>
              <MapPin size={16} />
              {b.address} · {b.canton}, {b.province}
            </p>
          </div>
          <p className="description">{bilingualText(b.description, b.descriptionEn)}</p>
          <div className="info-strip">
            <span>
              <Phone size={17} />
              {b.phone}
            </span>
            <span>
              <Clock3 size={17} />
              {t("business:timeZone")}
            </span>
          </div>
          <h2>{t("business:services.title")}</h2>
          <div className="service-list">
            {b.services.map((s) => (
              <button
                key={s.id}
                className={`service-option ${serviceId === s.id ? "selected" : ""}`}
                onClick={() => setService(s.id)}
              >
                <span>
                  <strong>{bilingualText(s.name, s.nameEn)}</strong>
                  <small>{bilingualText(s.description, s.descriptionEn)}</small>
                  <span className="muted">{t("business:duration", { count: s.duration })}</span>
                </span>
                <span>
                  <strong>{money(s.price)}</strong>
                  <span className="radio" />
                </span>
              </button>
            ))}
          </div>
          <div className="panel">
            <h3>{t("business:hours.title")}</h3>
            {weekdays.map((_, i) => (
              <div className="hours-summary" key={i}>
                <span>{weekdayName(i)}</span>
                <span>
                  {b.hours
                    .filter((h) => h.weekday === i)
                    .map(
                      (h) =>
                        `${minuteTime(h.startMinute)} – ${minuteTime(h.endMinute)}`,
                    )
                    .join(" / ") || t("business:hours.closed")}
                </span>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel booking-panel">
          <span className="eyebrow">{t("business:booking.eyebrow")}</span>
          <h2>{t("business:booking.title")}</h2>
          {success ? (
            <div className="success-state" role="status">
              <CheckCircle2 size={48} />
              <h3>{t("business:success.title")}</h3>
              <strong>{success.code}</strong>
              <p>{dateTime(success.startAt)}</p>
              <p>
                {t("business:success.description")}
              </p>
              <Link className="button full" to="/reservas">
                {t("business:success.link")}
              </Link>
            </div>
          ) : (
            <>
              <div className="booking-step">
                <span>1</span>
                <strong>
                  {selected ? bilingualText(selected.name, selected.nameEn) : t("business:booking.service")}
                </strong>
              </div>
              <div className="booking-step">
                <span>2</span>
                <strong>{t("business:booking.moment")}</strong>
              </div>
              <Field label={t("business:booking.date")}>
                <input
                  type="date"
                  min={today()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
              {!serviceId ? (
                <p className="hint">
                  {t("business:booking.choose")}
                </p>
              ) : availability.loading ? (
                <Loading />
              ) : (
                <>
                  <ErrorBox message={availability.error} />
                  <div className="slots">
                    {availability.data?.slots.map((s) => (
                      <button
                        className={slot === s.startAt ? "selected" : ""}
                        key={s.startAt}
                        onClick={() => {
                          setSlot(s.startAt);
                          key.current = crypto.randomUUID();
                        }}
                      >
                        {time(s.startAt)}
                        <small>
                          {t("business:capacity", { count: s.remaining })}
                        </small>
                      </button>
                    ))}
                  </div>
                  {!availability.error && !availability.data?.slots.length && (
                    <Empty title={t("business:empty.title")}>
                      <p>{t("business:empty.description")}</p>
                    </Empty>
                  )}
                </>
              )}
              <Field label={t("business:booking.notes")}>
                <textarea
                  maxLength={500}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    key.current = crypto.randomUUID();
                  }}
                  placeholder={t("business:booking.notesPlaceholder")}
                />
              </Field>
              <div className="booking-total">
                <span>{t("business:booking.price")}</span>
                <strong>{selected ? money(selected.price) : "—"}</strong>
              </div>
              <p className="hint">
                {t("business:booking.policy", { minutes: b.cancellationMinutes })}
              </p>
              <ErrorBox message={failure} />
              {!user ? (
                <Link
                  className="button full"
                  to={`/ingresar?next=/negocios/${b.id}`}
                >
                  {t("business:booking.login")}
                </Link>
              ) : user.role !== "CLIENT" ? (
                <p className="hint">
                  {t("business:booking.client")}
                </p>
              ) : (
                <button
                  className="button full"
                  disabled={!slot || busy}
                  onClick={async () => {
                    setBusy(true);
                    setFailure("");
                    try {
                      const r = await api(
                        "/bookings",
                        send("POST", {
                          serviceId,
                          startAt: slot,
                          notes,
                          idempotencyKey: key.current,
                        }),
                      );
                      setSuccess(r);
                    } catch (e) {
                      setFailure((e as Error).message);
                      availability.reload();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? t("business:booking.busy") : t("business:booking.confirm")}
                  <CheckCircle2 size={18} />
                </button>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
