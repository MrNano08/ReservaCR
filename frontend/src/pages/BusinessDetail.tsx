import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, Phone, Clock3, CheckCircle2, ArrowLeft } from "lucide-react";
import { useLoad } from "../hooks/useLoad";
import { useAuth } from "../hooks/useAuth";
import { Business } from "../types";
import { api, send } from "../services/api";
import { BusinessArt, ErrorBox, Loading, Field, Empty } from "../components/UI";
import {
  money,
  time,
  dateTime,
  today,
  weekdays,
  minuteTime,
} from "../utils/format";
export default function BusinessDetail() {
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
        Volver a explorar
      </Link>
      <div className="detail-grid">
        <section>
          <BusinessArt business={b} large />
          <div className="page-head">
            <span className="eyebrow">{b.category.name}</span>
            <h1>{b.name}</h1>
            <p>
              <MapPin size={16} />
              {b.address} · {b.canton}, {b.province}
            </p>
          </div>
          <p className="description">{b.description}</p>
          <div className="info-strip">
            <span>
              <Phone size={17} />
              {b.phone}
            </span>
            <span>
              <Clock3 size={17} />
              Hora de Costa Rica
            </span>
          </div>
          <h2>Encuentra tu servicio</h2>
          <div className="service-list">
            {b.services.map((s) => (
              <button
                key={s.id}
                className={`service-option ${serviceId === s.id ? "selected" : ""}`}
                onClick={() => setService(s.id)}
              >
                <span>
                  <strong>{s.name}</strong>
                  <small>{s.description}</small>
                  <span className="muted">{s.duration} minutos</span>
                </span>
                <span>
                  <strong>{money(s.price)}</strong>
                  <span className="radio" />
                </span>
              </button>
            ))}
          </div>
          <div className="panel">
            <h3>Horario de atención</h3>
            {weekdays.map((name, i) => (
              <div className="hours-summary" key={i}>
                <span>{name}</span>
                <span>
                  {b.hours
                    .filter((h) => h.weekday === i)
                    .map(
                      (h) =>
                        `${minuteTime(h.startMinute)} – ${minuteTime(h.endMinute)}`,
                    )
                    .join(" / ") || "Cerrado"}
                </span>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel booking-panel">
          <span className="eyebrow">HAZ UN ESPACIO PARA TI</span>
          <h2>Reserva tu cita</h2>
          {success ? (
            <div className="success-state" role="status">
              <CheckCircle2 size={48} />
              <h3>Tu cita está confirmada</h3>
              <strong>{success.code}</strong>
              <p>{dateTime(success.startAt)}</p>
              <p>
                La encontrarás en tus reservas. La notificación por correo se
                procesará por separado.
              </p>
              <Link className="button full" to="/reservas">
                Ver mis reservas
              </Link>
            </div>
          ) : (
            <>
              <div className="booking-step">
                <span>1</span>
                <strong>
                  {selected ? selected.name : "Selecciona un servicio"}
                </strong>
              </div>
              <div className="booking-step">
                <span>2</span>
                <strong>Encuentra tu momento</strong>
              </div>
              <Field label="Fecha de la cita">
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
                  Elige un servicio para consultar horarios disponibles.
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
                          {s.remaining} {s.remaining === 1 ? "cupo" : "cupos"}
                        </small>
                      </button>
                    ))}
                  </div>
                  {!availability.error && !availability.data?.slots.length && (
                    <Empty title="Sin horarios disponibles">
                      <p>Prueba con otra fecha.</p>
                    </Empty>
                  )}
                </>
              )}
              <Field label="Nota para el negocio (opcional)">
                <textarea
                  maxLength={500}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    key.current = crypto.randomUUID();
                  }}
                  placeholder="¿Algo que debamos saber?"
                />
              </Field>
              <div className="booking-total">
                <span>Precio del servicio</span>
                <strong>{selected ? money(selected.price) : "—"}</strong>
              </div>
              <p className="hint">
                Cancelación hasta {b.cancellationMinutes} minutos antes de la
                cita. El pago, si corresponde, se coordina con el negocio.
              </p>
              <ErrorBox message={failure} />
              {!user ? (
                <Link
                  className="button full"
                  to={`/ingresar?next=/negocios/${b.id}`}
                >
                  Inicia sesión para reservar
                </Link>
              ) : user.role !== "CLIENT" ? (
                <p className="hint">
                  Las reservas se realizan desde una cuenta de cliente.
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
                  {busy ? "Confirmando…" : "Confirmar reserva"}
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
