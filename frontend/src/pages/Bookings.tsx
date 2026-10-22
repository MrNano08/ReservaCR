import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Search, MapPin, Clock3 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useLoad } from "../hooks/useLoad";
import { Booking } from "../types";
import { api, send } from "../services/api";
import { bilingualText } from "../i18n/content";
import {
  PageHead,
  Badge,
  ErrorBox,
  Loading,
  Empty,
  Field,
  CharacterLimit,
} from "../components/UI";
import { dateTime, money, time, number } from "../utils/format";
export default function Bookings() {
  const { t, i18n } = useTranslation("bookings");
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad<Booking[]>("/bookings");
  const [filter, setFilter] = useState("upcoming"),
    [q, setQ] = useState(""),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(""),
    [cancel, setCancel] = useState<Booking | null>(null),
    [reason, setReason] = useState("");
  const owner = user?.role === "BUSINESS";
  const rows = data?.filter(
    (b) =>
      (filter === "all" ||
        (filter === "upcoming" &&
          b.status === "CONFIRMED" &&
          new Date(b.endAt) > new Date()) ||
        (filter === "history" &&
          (b.status !== "CONFIRMED" || new Date(b.endAt) <= new Date()))) &&
      `${b.code} ${bilingualText(b.serviceName, b.serviceNameEn)} ${b.business.name} ${b.client?.name || ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  async function change(b: Booking, status: string) {
    setBusy(b.id);
    setFailure("");
    try {
      await api(`/bookings/${b.id}`, send("PATCH", { status, reason, ...(status === "CANCELLED" ? { language: i18n.resolvedLanguage?.split("-")[0] === "en" ? "en" : "es" } : {}) }));
      setCancel(null);
      setReason("");
      reload();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHead
        eyebrow={owner ? t("bookings:head.ownerEyebrow") : t("bookings:head.clientEyebrow")}
        title={owner ? t("bookings:head.ownerTitle") : t("bookings:head.clientTitle")}
      >
        {t("bookings:head.description")}
      </PageHead>
      <div className="stats-grid">
        <div className="stat">
          <span>{t("bookings:stats.upcoming")}</span>
          <strong>
            {number(data?.filter(
              (b) => b.status === "CONFIRMED" && new Date(b.endAt) > new Date(),
            ).length || 0)}
          </strong>
        </div>
        <div className="stat">
          <span>{t("bookings:stats.completed")}</span>
          <strong>
            {number(data?.filter((b) => b.status === "COMPLETED").length || 0)}
          </strong>
        </div>
        <div className="stat">
          <span>{t("bookings:stats.cancelled")}</span>
          <strong>
            {number(data?.filter((b) => b.status === "CANCELLED").length || 0)}
          </strong>
        </div>
      </div>
      <div className="toolbar">
        <div className="tabs">
          {[
            ["upcoming", t("bookings:filters.upcoming")],
            ["history", t("bookings:filters.history")],
            ["all", t("bookings:filters.all")],
          ].map(([v, l]) => (
            <button
              className={filter === v ? "active" : ""}
              key={v}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="inline-search">
          <Search size={18} />
          <span className="limit-control">
            <input
              placeholder={t("bookings:search")}
              maxLength={100}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <CharacterLimit max={100} />
          </span>
        </label>
      </div>
      <ErrorBox message={error || failure} />
      {loading ? (
        <Loading />
      ) : rows?.length ? (
        <div className="booking-list">
          {rows.map((b) => (
            <article className="panel reservation" key={b.id}>
              <div className="reservation-icon">
                <CalendarDays />
              </div>
              <div className="reservation-main">
                <div className="row">
                  <h3>{bilingualText(b.serviceName, b.serviceNameEn)}</h3>
                  <Badge value={b.status} />
                </div>
                <p>
                  <MapPin size={14} />
                  {b.business.name}
                </p>
                <p>
                  <Clock3 size={14} />
                  {dateTime(b.startAt)} –{" "}
                  {time(b.endAt)}
                </p>
                <small>
                  {b.code} · {money(b.price)}
                </small>
                {b.client && (
                  <p>
                    {t("bookings:detail.client", { name: b.client.name, email: b.client.email, phone: b.client.phone })}
                  </p>
                )}
                {b.notes && <p>{t("bookings:detail.notes", { notes: b.notes })}</p>}
                {b.cancellationReason && <p>{t("bookings:detail.reason", { reason: b.cancellationReason })}</p>}
              </div>
              <div className="reservation-actions">
                {b.status === "CONFIRMED" &&
                  (new Date(b.startAt) > new Date() ? (
                    <button
                      className="danger subtle"
                      disabled={
                        busy === b.id ||
                        (!owner &&
                          new Date(b.startAt).getTime() - Date.now() <
                            b.business.cancellationMinutes * 60000)
                      }
                      onClick={() => {
                        setCancel(b);
                        setReason("");
                      }}
                    >
                      {t("bookings:actions.cancel")}
                    </button>
                  ) : owner && new Date(b.endAt) <= new Date() ? (
                    <>
                      <button
                        disabled={!!busy}
                        onClick={() => change(b, "COMPLETED")}
                      >
                        {t("bookings:actions.complete")}
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => change(b, "NO_SHOW")}
                      >
                        {t("bookings:actions.noShow")}
                      </button>
                    </>
                  ) : null)}
                <Link to={`/negocios/${b.business.id}`}>{t("bookings:actions.business")}</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title={t("bookings:empty.title")}>
          {!owner && (
            <Link className="button" to="/">
              {t("bookings:empty.explore")}
            </Link>
          )}
        </Empty>
      )}
      {cancel && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
          >
            <h2 id="cancel-title">{t("bookings:cancel.title")}</h2>
            <p>
              {bilingualText(cancel.serviceName, cancel.serviceNameEn)} · {dateTime(cancel.startAt)}
            </p>
            <Field label={t("bookings:cancel.reason")}>
              <textarea
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <ErrorBox message={failure} />
            <div className="row">
              <button disabled={!!busy} onClick={() => setCancel(null)}>
                {t("bookings:cancel.keep")}
              </button>
              <button
                className="button danger"
                disabled={!!busy}
                onClick={() => change(cancel, "CANCELLED")}
              >
                {busy ? t("bookings:cancel.busy") : t("bookings:cancel.confirm")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
