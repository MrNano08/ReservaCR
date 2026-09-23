import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Search, MapPin, Clock3 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useLoad } from "../hooks/useLoad";
import { Booking } from "../types";
import { api, send } from "../services/api";
import {
  PageHead,
  Badge,
  ErrorBox,
  Loading,
  Empty,
  Field,
} from "../components/UI";
import { dateTime, money } from "../utils/format";
export default function Bookings() {
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
      `${b.code} ${b.serviceName} ${b.business.name} ${b.client?.name || ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  async function change(b: Booking, status: string) {
    setBusy(b.id);
    setFailure("");
    try {
      await api(`/bookings/${b.id}`, send("PATCH", { status, reason }));
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
        eyebrow={owner ? "TU AGENDA" : "TU TIEMPO, ORGANIZADO"}
        title={owner ? "Reservas del negocio" : "Mis reservas"}
      >
        Consulta tus próximas citas y su historial. Todos los horarios
        corresponden a Costa Rica.
      </PageHead>
      <div className="stats-grid">
        <div className="stat">
          <span>Próximas citas</span>
          <strong>
            {data?.filter(
              (b) => b.status === "CONFIRMED" && new Date(b.endAt) > new Date(),
            ).length || 0}
          </strong>
        </div>
        <div className="stat">
          <span>Completadas</span>
          <strong>
            {data?.filter((b) => b.status === "COMPLETED").length || 0}
          </strong>
        </div>
        <div className="stat">
          <span>Canceladas</span>
          <strong>
            {data?.filter((b) => b.status === "CANCELLED").length || 0}
          </strong>
        </div>
      </div>
      <div className="toolbar">
        <div className="tabs">
          {[
            ["upcoming", "Próximas"],
            ["history", "Historial"],
            ["all", "Todas"],
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
          <input
            placeholder="Buscar reserva…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
                  <h3>{b.serviceName}</h3>
                  <Badge value={b.status} />
                </div>
                <p>
                  <MapPin size={14} />
                  {b.business.name}
                </p>
                <p>
                  <Clock3 size={14} />
                  {dateTime(b.startAt)} –{" "}
                  {new Intl.DateTimeFormat("es-CR", {
                    timeZone: "America/Costa_Rica",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(b.endAt))}
                </p>
                <small>
                  {b.code} · {money(b.price)}
                </small>
                {b.client && (
                  <p>
                    Cliente: {b.client.name} · {b.client.email} ·{" "}
                    {b.client.phone}
                  </p>
                )}
                {b.notes && <p>Nota: {b.notes}</p>}
                {b.cancellationReason && <p>Motivo: {b.cancellationReason}</p>}
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
                      Cancelar cita
                    </button>
                  ) : owner && new Date(b.endAt) <= new Date() ? (
                    <>
                      <button
                        disabled={!!busy}
                        onClick={() => change(b, "COMPLETED")}
                      >
                        Marcar completada
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => change(b, "NO_SHOW")}
                      >
                        No asistió
                      </button>
                    </>
                  ) : null)}
                <Link to={`/negocios/${b.business.id}`}>Ver negocio ↗</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No hay reservas en esta vista">
          {!owner && (
            <Link className="button" to="/">
              Explorar negocios
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
            <h2 id="cancel-title">¿Cancelar esta cita?</h2>
            <p>
              {cancel.serviceName} · {dateTime(cancel.startAt)}
            </p>
            <Field label="Motivo (opcional)">
              <textarea
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <ErrorBox message={failure} />
            <div className="row">
              <button disabled={!!busy} onClick={() => setCancel(null)}>
                Mantener cita
              </button>
              <button
                className="button danger"
                disabled={!!busy}
                onClick={() => change(cancel, "CANCELLED")}
              >
                {busy ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
