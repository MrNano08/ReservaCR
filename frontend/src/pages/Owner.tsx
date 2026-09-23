import { useEffect, useState, FormEvent } from "react";
import { Plus, Trash2, Save, Upload, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useLoad } from "../hooks/useLoad";
import { Business, Category, Hour, Service } from "../types";
import { api, send, ApiError } from "../services/api";
import { PageHead, Field, ErrorBox, Loading, Badge } from "../components/UI";
import {
  weekdays,
  minuteTime,
  money,
  provinces,
  dateTime,
} from "../utils/format";
const blank = {
  name: "",
  description: "",
  province: "Guanacaste",
  canton: "",
  address: "",
  phone: "",
  categoryId: "",
  capacity: 1,
  cancellationMinutes: 120,
};
export default function Owner() {
  const categories = useLoad<Category[]>("/categories");
  const [b, setB] = useState<Business | null>(null),
    [profile, setProfile] = useState(blank),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState("profile"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [hours, setHours] = useState<Hour[]>([]),
    [service, setService] = useState<Partial<Service> | null>(null);
  async function load() {
    try {
      const data = await api<Business>("/owner/business");
      setB(data);
      setProfile(
        Object.fromEntries(
          Object.keys(blank).map((k) => [k, data[k as keyof Business]]),
        ) as typeof blank,
      );
      setHours(
        data.hours.map(({ weekday, startMinute, endMinute }) => ({
          weekday,
          startMinute,
          endMinute,
        })),
      );
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404))
        setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field<K extends keyof typeof blank>(k: K, value: (typeof blank)[K]) {
    setProfile((p) => ({ ...p, [k]: value }));
  }
  if (loading) return <Loading />;
  return (
    <>
      <PageHead
        eyebrow="ESPACIO DEL NEGOCIO"
        title={b ? b.name : "Dale un lugar a tu negocio"}
      >
        Configura tu perfil, tus servicios y los horarios que tus clientes
        podrán reservar.
      </PageHead>
      {b && (
        <div className="owner-status panel">
          <div className="row">
            <Badge value={b.status} />
            <span>
              {b.published ? "Visible en el catálogo" : "Sin publicar"}
            </span>
          </div>
          <div className="row">
            {b.status === "REJECTED" && (
              <button
                disabled={busy}
                onClick={() =>
                  action(
                    () => api("/owner/resubmit", send("POST")),
                    "Solicitud enviada a revisión.",
                  )
                }
              >
                Solicitar otra revisión
              </button>
            )}
            <button
              disabled={busy || b.status !== "APPROVED"}
              className="button small"
              onClick={() =>
                action(
                  () =>
                    api(
                      "/owner/publish",
                      send("PATCH", { published: !b.published }),
                    ),
                  b.published ? "Negocio oculto." : "Negocio publicado.",
                )
              }
            >
              {b.published ? "Ocultar negocio" : "Publicar negocio"}
            </button>
            {b.published && (
              <Link
                to={`/negocios/${b.id}`}
                className="icon-button"
                aria-label="Ver perfil público"
              >
                <ExternalLink size={19} />
              </Link>
            )}
          </div>
          {b.reviewNote && (
            <p className="review-note">Revisión: {b.reviewNote}</p>
          )}
        </div>
      )}
      <div className="tabs owner-tabs">
        {[
          ["profile", "Perfil"],
          ["services", "Servicios"],
          ["hours", "Horarios y cupos"],
          ["blocks", "Bloqueos"],
        ].map(([v, l]) => (
          <button
            disabled={!b && v !== "profile"}
            className={tab === v ? "active" : ""}
            onClick={() => {
              setTab(v);
              setError("");
              setNotice("");
            }}
            key={v}
          >
            {l}
          </button>
        ))}
      </div>
      <ErrorBox message={error || categories.error} />
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      {tab === "profile" && (
        <form
          className="panel form-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void action(
              () => api("/owner/business", send("PUT", profile)),
              "Perfil guardado.",
            );
          }}
        >
          <h2>La primera impresión cuenta</h2>
          <div className="form-grid">
            <Field label="Nombre del negocio">
              <input
                required
                minLength={2}
                maxLength={120}
                value={profile.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </Field>
            <Field label="Categoría">
              <select
                required
                value={profile.categoryId}
                onChange={(e) => field("categoryId", e.target.value)}
              >
                <option value="">Selecciona una categoría</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Provincia">
              <select
                value={profile.province}
                onChange={(e) => field("province", e.target.value)}
              >
                {provinces.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Cantón">
              <input
                required
                minLength={2}
                maxLength={80}
                value={profile.canton}
                onChange={(e) => field("canton", e.target.value)}
              />
            </Field>
            <Field label="Dirección exacta">
              <input
                required
                minLength={5}
                maxLength={300}
                value={profile.address}
                onChange={(e) => field("address", e.target.value)}
              />
            </Field>
            <Field label="Teléfono de contacto">
              <input
                type="tel"
                required
                minLength={8}
                maxLength={25}
                value={profile.phone}
                onChange={(e) => field("phone", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Cuéntales sobre tu negocio">
            <textarea
              required
              minLength={10}
              maxLength={2500}
              value={profile.description}
              onChange={(e) => field("description", e.target.value)}
            />
          </Field>
          <button className="button" disabled={busy}>
            <Save size={17} />
            {busy ? "Guardando…" : "Guardar perfil"}
          </button>
          {!b && (
            <p className="hint">
              Tu negocio se enviará a revisión. Después de su aprobación podrás
              publicarlo con servicios y horarios.
            </p>
          )}
          {b && (
            <div className="upload-area">
              <Upload size={24} />
              <Field label="Imagen del negocio (JPG, PNG o WebP, máximo 5 MB)">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setError("La imagen supera los 5 MB.");
                      return;
                    }
                    const fd = new FormData();
                    fd.set("image", file);
                    void action(
                      () => api("/owner/image", { method: "POST", body: fd }),
                      "Imagen actualizada.",
                    );
                  }}
                />
              </Field>
              {b.imageUrl && (
                <img src={b.imageUrl} alt="Imagen actual del negocio" />
              )}
            </div>
          )}
        </form>
      )}
      {tab === "services" && (
        <section className="panel">
          <div className="section-title">
            <h2>Tus servicios</h2>
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                setService({
                  name: "",
                  description: "",
                  duration: 30,
                  price: null,
                  active: true,
                })
              }
            >
              <Plus size={17} />
              Agregar servicio
            </button>
          </div>
          {b?.services.map((s) => (
            <div className="management-row" key={s.id}>
              <div>
                <h3>
                  {s.name} {!s.active && <small>(Inactivo)</small>}
                </h3>
                <p>
                  {s.duration} min · {money(s.price)}
                </p>
              </div>
              <button disabled={busy} onClick={() => setService(s)}>
                Editar
              </button>
            </div>
          ))}
          {!b?.services.length && (
            <p className="hint">
              Agrega tu primer servicio para poder publicar el negocio.
            </p>
          )}
          {service && (
            <form
              className="editor"
              onSubmit={(e) => {
                e.preventDefault();
                const { id, name, description, duration, price, active } =
                  service;
                void action(async () => {
                  await api(
                    id ? `/owner/services/${id}` : "/owner/services",
                    send(id ? "PUT" : "POST", {
                      name,
                      description,
                      duration,
                      price,
                      active,
                    }),
                  );
                  setService(null);
                }, "Servicio guardado.");
              }}
            >
              <h3>{service.id ? "Editar servicio" : "Nuevo servicio"}</h3>
              <div className="form-grid">
                <Field label="Nombre">
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={service.name}
                    onChange={(e) =>
                      setService({ ...service, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Duración (minutos, múltiplos de 30)">
                  <input
                    type="number"
                    min={30}
                    max={480}
                    step={30}
                    required
                    value={service.duration}
                    onChange={(e) =>
                      setService({
                        ...service,
                        duration: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Precio en colones (vacío: consultar)">
                  <input
                    type="number"
                    min={0}
                    max={10000000}
                    step={1}
                    value={service.price ?? ""}
                    onChange={(e) =>
                      setService({
                        ...service,
                        price:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Estado">
                  <select
                    value={String(service.active)}
                    onChange={(e) =>
                      setService({
                        ...service,
                        active: e.target.value === "true",
                      })
                    }
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </Field>
              </div>
              <Field label="Descripción">
                <textarea
                  maxLength={500}
                  value={service.description}
                  onChange={(e) =>
                    setService({ ...service, description: e.target.value })
                  }
                />
              </Field>
              <div className="row">
                <button className="button" disabled={busy}>
                  Guardar servicio
                </button>
                <button type="button" onClick={() => setService(null)}>
                  Cerrar
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      {tab === "hours" && (
        <section className="panel">
          <h2>Capacidad y disponibilidad</h2>
          <p className="hint">
            Los cupos son compartidos por todos los servicios. Un servicio largo
            ocupa un cupo en cada intervalo de 30 minutos.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                () => api("/owner/business", send("PUT", profile)),
                "Cupos y política guardados.",
              );
            }}
          >
            <div className="form-grid">
              <Field label="Cupos simultáneos del negocio">
                <input
                  type="number"
                  required
                  min={1}
                  max={50}
                  value={profile.capacity}
                  onChange={(e) => field("capacity", Number(e.target.value))}
                />
              </Field>
              <Field label="Anticipación mínima para cancelar (minutos)">
                <input
                  type="number"
                  required
                  min={0}
                  max={10080}
                  value={profile.cancellationMinutes}
                  onChange={(e) =>
                    field("cancellationMinutes", Number(e.target.value))
                  }
                />
              </Field>
            </div>
            <button disabled={busy}>Guardar cupos y cancelación</button>
          </form>
          <hr />
          <h3>Horario semanal</h3>
          <p className="hint">
            Puedes agregar dos franjas al mismo día para dejar un descanso. No
            se permiten franjas superpuestas.
          </p>
          {hours.map((h, i) => (
            <div className="hours-editor" key={i}>
              <select
                aria-label="Día"
                value={h.weekday}
                onChange={(e) =>
                  setHours(
                    hours.map((v, j) =>
                      j === i ? { ...v, weekday: Number(e.target.value) } : v,
                    ),
                  )
                }
              >
                {weekdays.map((d, k) => (
                  <option key={k} value={k}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                aria-label="Apertura"
                value={h.startMinute}
                onChange={(e) =>
                  setHours(
                    hours.map((v, j) =>
                      j === i
                        ? { ...v, startMinute: Number(e.target.value) }
                        : v,
                    ),
                  )
                }
              >
                {Array.from({ length: 48 }, (_, j) => (
                  <option key={j} value={j * 30}>
                    {minuteTime(j * 30)}
                  </option>
                ))}
              </select>
              <span>hasta</span>
              <select
                aria-label="Cierre"
                value={h.endMinute}
                onChange={(e) =>
                  setHours(
                    hours.map((v, j) =>
                      j === i ? { ...v, endMinute: Number(e.target.value) } : v,
                    ),
                  )
                }
              >
                {Array.from({ length: 48 }, (_, j) => (
                  <option key={j} value={(j + 1) * 30}>
                    {minuteTime((j + 1) * 30)}
                  </option>
                ))}
              </select>
              <button
                className="icon-button danger"
                aria-label="Quitar franja"
                onClick={() => setHours(hours.filter((_, j) => j !== i))}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <div className="row">
            <button
              disabled={hours.length >= 28}
              onClick={() =>
                setHours([
                  ...hours,
                  { weekday: 1, startMinute: 480, endMinute: 1020 },
                ])
              }
            >
              <Plus size={16} />
              Agregar franja
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                action(
                  () => api("/owner/hours", send("PUT", hours)),
                  "Horario actualizado.",
                )
              }
            >
              Guardar horarios
            </button>
          </div>
        </section>
      )}
      {tab === "blocks" && (
        <section className="panel">
          <h2>Descansos y cierres excepcionales</h2>
          <p className="hint">
            No se aceptan bloqueos que se crucen con reservas vigentes. Horas de
            Costa Rica.
          </p>
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const form = e.currentTarget,
                d = Object.fromEntries(new FormData(form));
              void action(async () => {
                await api(
                  "/owner/blocks",
                  send("POST", {
                    startAt: new Date(`${d.startAt}:00-06:00`).toISOString(),
                    endAt: new Date(`${d.endAt}:00-06:00`).toISOString(),
                    reason: d.reason,
                  }),
                );
                form.reset();
              }, "Bloqueo agregado.");
            }}
          >
            <div className="form-grid">
              <Field label="Desde">
                <input
                  name="startAt"
                  type="datetime-local"
                  step={1800}
                  required
                />
              </Field>
              <Field label="Hasta">
                <input
                  name="endAt"
                  type="datetime-local"
                  step={1800}
                  required
                />
              </Field>
            </div>
            <Field label="Motivo">
              <input
                name="reason"
                required
                maxLength={200}
                placeholder="Feriado, mantenimiento, descanso…"
              />
            </Field>
            <button className="button" disabled={busy}>
              Agregar bloqueo
            </button>
          </form>
          <hr />
          {b?.blocks.map((x) => (
            <div className="management-row" key={x.id}>
              <div>
                <strong>{x.reason}</strong>
                <p>
                  {dateTime(x.startAt)} — {dateTime(x.endAt)}
                </p>
              </div>
              <button
                className="danger"
                disabled={busy}
                onClick={() =>
                  action(
                    () => api(`/owner/blocks/${x.id}`, send("DELETE")),
                    "Bloqueo eliminado.",
                  )
                }
              >
                Eliminar
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
