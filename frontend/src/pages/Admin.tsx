import { useState } from "react";
import { useLoad } from "../hooks/useLoad";
import { Business, Category } from "../types";
import { api, send } from "../services/api";
import {
  PageHead,
  ErrorBox,
  Loading,
  Badge,
  Field,
  Empty,
} from "../components/UI";
import { dateTime, money, weekdays, minuteTime } from "../utils/format";
export default function Admin() {
  const [tab, setTab] = useState("businesses"),
    [filter, setFilter] = useState("ALL"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Business | null>(null),
    [note, setNote] = useState("");
  const businesses = useLoad<Business[]>(
    tab === "businesses" ? "/admin/businesses" : null,
  );
  const categories = useLoad<Category[]>(
    tab === "categories" ? "/admin/categories" : null,
  );
  const audit = useLoad<
    {
      id: string;
      action: string;
      resourceId: string;
      detail: string;
      createdAt: string;
    }[]
  >(tab === "audit" ? "/admin/audit" : null);
  const jobs = useLoad<
    {
      id: string;
      subject: string;
      status: string;
      attempts: number;
      createdAt: string;
    }[]
  >(tab === "mail" ? "/admin/notifications" : null);
  async function action(fn: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await fn();
      businesses.reload();
      categories.reload();
      audit.reload();
      jobs.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead eyebrow="ADMINISTRACIÓN" title="Un catálogo en buenas manos">
        Revisa solicitudes, administra categorías y consulta los movimientos de
        la plataforma.
      </PageHead>
      <div className="tabs owner-tabs">
        {[
          ["businesses", "Negocios"],
          ["categories", "Categorías"],
          ["mail", "Correos"],
          ["audit", "Actividad"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={tab === v ? "active" : ""}
            onClick={() => {
              setTab(v);
              setError("");
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <ErrorBox
        message={
          error ||
          businesses.error ||
          categories.error ||
          audit.error ||
          jobs.error
        }
      />
      {tab === "businesses" && (
        <>
          <div className="toolbar">
            <h2>Solicitudes y negocios</h2>
            <select
              aria-label="Filtrar por estado"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">Todos los estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="APPROVED">Aprobados</option>
              <option value="REJECTED">Rechazados</option>
              <option value="SUSPENDED">Suspendidos</option>
            </select>
          </div>
          {businesses.loading ? (
            <Loading />
          ) : businesses.data?.length ? (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Negocio</th>
                    <th>Ubicación</th>
                    <th>Estado</th>
                    <th>Publicación</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.data
                    .filter((b) => filter === "ALL" || b.status === filter)
                    .map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.name}</strong>
                          <small>{b.category?.name}</small>
                        </td>
                        <td>{b.canton}</td>
                        <td>
                          <Badge value={b.status} />
                        </td>
                        <td>{b.published ? "Publicado" : "Oculto"}</td>
                        <td>
                          <button
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                setSelected(
                                  await api(`/admin/businesses/${b.id}`),
                                );
                                setNote(b.reviewNote);
                              })
                            }
                          >
                            Revisar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Todavía no hay negocios registrados" />
          )}
        </>
      )}
      {tab === "categories" && (
        <section className="panel">
          <h2>Categorías del catálogo</h2>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const name = new FormData(form).get("name");
              void action(async () => {
                await api("/admin/categories", send("POST", { name }));
                form.reset();
              });
            }}
          >
            <input
              aria-label="Nueva categoría"
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="Nombre de la nueva categoría"
            />
            <button className="button" disabled={busy}>
              Agregar
            </button>
          </form>
          {categories.loading ? (
            <Loading />
          ) : (
            categories.data?.map((c) => (
              <form
                className="management-row"
                key={c.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  void action(() =>
                    api(
                      `/admin/categories/${c.id}`,
                      send("PATCH", {
                        name: d.get("name"),
                        active: d.get("active") === "on",
                      }),
                    ),
                  );
                }}
              >
                <input
                  name="name"
                  aria-label="Nombre de categoría"
                  defaultValue={c.name}
                  required
                  minLength={2}
                  maxLength={80}
                />
                <label className="row">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={c.active}
                  />
                  Activa
                </label>
                <button disabled={busy}>Guardar</button>
              </form>
            ))
          )}
          <p className="hint">
            Desactivar una categoría impide usarla en nuevos registros. Los
            negocios existentes conservan su categoría e historial.
          </p>
        </section>
      )}
      {tab === "mail" && (
        <section className="panel">
          <h2>Estado de notificaciones</h2>
          <p className="hint">
            El fallo de correo no elimina la reserva. Los envíos pendientes se
            reintentan automáticamente cuando SMTP está configurado.
          </p>
          {jobs.loading ? (
            <Loading />
          ) : (
            jobs.data?.map((j) => (
              <div className="management-row" key={j.id}>
                <div>
                  <strong>{j.subject}</strong>
                  <p>
                    {dateTime(j.createdAt)} · {j.attempts} intentos
                  </p>
                </div>
                <Badge value={j.status} />
                {j.status === "FAILED" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      action(() =>
                        api(`/admin/notifications/${j.id}/retry`, send("POST")),
                      )
                    }
                  >
                    Reintentar
                  </button>
                )}
              </div>
            ))
          )}
        </section>
      )}
      {tab === "audit" && (
        <section className="panel table-scroll">
          <h2>Últimos movimientos</h2>
          {audit.loading ? (
            <Loading />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Recurso</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {audit.data?.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.createdAt)}</td>
                    <td>
                      {(
                        {
                          BUSINESS_APPROVED: "Negocio aprobado",
                          BUSINESS_REJECTED: "Negocio rechazado",
                          BUSINESS_SUSPENDED: "Negocio suspendido",
                          CATEGORY_CREATE: "Categoría creada",
                          CATEGORY_UPDATE: "Categoría actualizada",
                          BOOKING_CONFIRMED: "Reserva confirmada",
                          BOOKING_CANCELLED: "Reserva cancelada",
                          BOOKING_COMPLETED: "Reserva completada",
                          BOOKING_NO_SHOW: "No asistió",
                        } as Record<string, string>
                      )[a.action] || a.action}
                    </td>
                    <td>
                      <small>{a.resourceId}</small>
                    </td>
                    <td>{a.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {selected && (
        <div className="modal-backdrop">
          <section
            className="panel modal wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
          >
            <div className="row between">
              <h2 id="review-title">{selected.name}</h2>
              <button onClick={() => setSelected(null)}>Cerrar</button>
            </div>
            <Badge value={selected.status} />
            <p>{selected.description}</p>
            <p>
              {selected.address} · {selected.canton}, {selected.province}
            </p>
            <p>
              Teléfono: {selected.phone} · {selected.capacity} cupos
            </p>
            <h3>Servicios</h3>
            {selected.services.map((s) => (
              <p key={s.id}>
                {s.name} · {s.duration} min · {money(s.price)}
              </p>
            ))}
            <h3>Horario</h3>
            {selected.hours.map((h, i) => (
              <p key={i}>
                {weekdays[h.weekday]}: {minuteTime(h.startMinute)} –{" "}
                {minuteTime(h.endMinute)}
              </p>
            ))}
            <Field label="Observaciones (obligatorias para rechazar o suspender)">
              <textarea
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <ErrorBox message={error} />
            <div className="row wrap">
              {[
                ["APPROVED", "Aprobar"],
                ["REJECTED", "Rechazar"],
                ["SUSPENDED", "Suspender"],
              ].map(([status, label]) => (
                <button
                  key={status}
                  className={status === "APPROVED" ? "button" : "danger"}
                  disabled={
                    busy || (status !== "APPROVED" && note.trim().length < 5)
                  }
                  onClick={() =>
                    action(async () => {
                      await api(
                        `/admin/businesses/${selected.id}`,
                        send("PATCH", { status, reviewNote: note }),
                      );
                      setSelected(null);
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
