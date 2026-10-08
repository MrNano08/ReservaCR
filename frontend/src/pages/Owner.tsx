import { useTranslation } from "react-i18next";
import { useEffect, useState, FormEvent } from "react";
import { Plus, Trash2, Save, Upload, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useLoad } from "../hooks/useLoad";
import { Business, Category, Hour, Service } from "../types";
import { api, send, ApiError } from "../services/api";
import { bilingualText, categoryLabel } from "../i18n/content";
import { PageHead, Field, ErrorBox, Loading, Badge } from "../components/UI";
import {
  weekdays,
  weekdayName,
  minuteTime,
  money,
  provinces,
  dateTime,
} from "../utils/format";
const blank = {
  name: "",
  description: "",
  descriptionEn: "",
  province: "Guanacaste",
  canton: "",
  address: "",
  phone: "",
  categoryId: "",
  capacity: 1,
  cancellationMinutes: 120,
};
export default function Owner() {
  const { t } = useTranslation("owner");
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
          Object.keys(blank).map((k) => [k, data[k as keyof Business] ?? blank[k as keyof typeof blank]]),
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
        eyebrow={t("owner:head.eyebrow")}
        title={b ? b.name : t("owner:head.title")}
      >
        {t("owner:head.description")}
      </PageHead>
      {b && (
        <div className="owner-status panel">
          <div className="row">
            <Badge value={b.status} />
            <span>
              {b.published ? t("owner:status.visible") : t("owner:status.hidden")}
            </span>
          </div>
          <div className="row">
            {b.status === "REJECTED" && (
              <button
                disabled={busy}
                onClick={() =>
                  action(
                    () => api("/owner/resubmit", send("POST")),
                    "owner:notice.review",
                  )
                }
              >
                {t("owner:actions.review")}
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
                  b.published ? "owner:notice.hidden" : "owner:notice.published",
                )
              }
            >
              {b.published ? t("owner:actions.hide") : t("owner:actions.publish")}
            </button>
            {b.published && (
              <Link
                to={`/negocios/${b.id}`}
                className="icon-button"
                aria-label={t("owner:actions.publicProfile")}
              >
                <ExternalLink size={19} />
              </Link>
            )}
          </div>
          {b.reviewNote && (
            <p className="review-note">{t("owner:reviewNote", { note: b.reviewNote })}</p>
          )}
        </div>
      )}
      <div className="tabs owner-tabs">
        {[
          ["profile", t("owner:tabs.profile")],
          ["services", t("owner:tabs.services")],
          ["hours", t("owner:tabs.hours")],
          ["blocks", t("owner:tabs.blocks")],
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
          {t(notice)}
        </div>
      )}
      {tab === "profile" && (
        <form
          className="panel form-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void action(
              () => api("/owner/business", send("PUT", profile)),
              "owner:notice.profile",
            );
          }}
        >
          <h2>{t("owner:profile.title")}</h2>
          <div className="form-grid">
            <Field label={t("owner:profile.name")}>
              <input
                required
                minLength={2}
                maxLength={120}
                value={profile.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </Field>
            <Field label={t("owner:profile.category")}>
              <select
                required
                value={profile.categoryId}
                onChange={(e) => field("categoryId", e.target.value)}
              >
                <option value="">{t("owner:profile.chooseCategory")}</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("owner:profile.province")}>
              <select
                value={profile.province}
                onChange={(e) => field("province", e.target.value)}
              >
                {provinces.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label={t("owner:profile.canton")}>
              <input
                required
                minLength={2}
                maxLength={80}
                value={profile.canton}
                onChange={(e) => field("canton", e.target.value)}
              />
            </Field>
            <Field label={t("owner:profile.address")}>
              <input
                required
                minLength={5}
                maxLength={300}
                value={profile.address}
                onChange={(e) => field("address", e.target.value)}
              />
            </Field>
            <Field label={t("owner:profile.phone")}>
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
          <Field label={t("owner:profile.description")}>
            <textarea
              required
              minLength={10}
              maxLength={2500}
              value={profile.description}
              onChange={(e) => field("description", e.target.value)}
            />
          </Field>
          <Field label={t("owner:profile.descriptionEn")}>
            <textarea maxLength={2500} value={profile.descriptionEn}
              onChange={(e) => field("descriptionEn", e.target.value)} />
          </Field>
          <button className="button" disabled={busy}>
            <Save size={17} />
            {busy ? t("owner:actions.saving") : t("owner:profile.save")}
          </button>
          {!b && (
            <p className="hint">
              {t("owner:profile.reviewHint")}
            </p>
          )}
          {b && (
            <div className="upload-area">
              <Upload size={24} />
              <Field label={t("owner:profile.image")}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setError("owner:errors.imageSize");
                      return;
                    }
                    const fd = new FormData();
                    fd.set("image", file);
                    void action(
                      () => api("/owner/image", { method: "POST", body: fd }),
                      "owner:notice.image",
                    );
                  }}
                />
              </Field>
              {b.imageUrl && (
                <img src={b.imageUrl} alt={t("owner:profile.imageAlt")} />
              )}
            </div>
          )}
        </form>
      )}
      {tab === "services" && (
        <section className="panel">
          <div className="section-title">
            <h2>{t("owner:services.title")}</h2>
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                setService({
                  name: "",
                  nameEn: "",
                  description: "",
                  descriptionEn: "",
                  duration: 30,
                  price: null,
                  active: true,
                })
              }
            >
              <Plus size={17} />
              {t("owner:services.add")}
            </button>
          </div>
          {b?.services.map((s) => (
            <div className="management-row" key={s.id}>
              <div>
                <h3>
                  {bilingualText(s.name, s.nameEn)} {!s.active && <small>{t("owner:services.inactive")}</small>}
                </h3>
                <p>
                  {t("owner:duration", { minutes: s.duration })} · {money(s.price)}
                </p>
              </div>
              <button disabled={busy} onClick={() => setService(s)}>
                {t("owner:actions.edit")}
              </button>
            </div>
          ))}
          {!b?.services.length && (
            <p className="hint">
              {t("owner:services.empty")}
            </p>
          )}
          {service && (
            <form
              className="editor"
              onSubmit={(e) => {
                e.preventDefault();
                const { id, name, nameEn, description, descriptionEn, duration, price, active } =
                  service;
                void action(async () => {
                  await api(
                    id ? `/owner/services/${id}` : "/owner/services",
                    send(id ? "PUT" : "POST", {
                      name,
                      nameEn,
                      description,
                      descriptionEn,
                      duration,
                      price,
                      active,
                    }),
                  );
                  setService(null);
                }, "owner:notice.service");
              }}
            >
              <h3>{service.id ? t("owner:services.edit") : t("owner:services.new")}</h3>
              <div className="form-grid">
                <Field label={t("owner:services.name")}>
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
                <Field label={t("owner:services.duration")}>
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
                <Field label={t("owner:services.price")}>
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
                <Field label={t("owner:services.status")}>
                  <select
                    value={String(service.active)}
                    onChange={(e) =>
                      setService({
                        ...service,
                        active: e.target.value === "true",
                      })
                    }
                  >
                    <option value="true">{t("owner:services.active")}</option>
                    <option value="false">{t("owner:services.inactiveOption")}</option>
                  </select>
                </Field>
              </div>
              <Field label={t("owner:services.nameEn")}>
                <input maxLength={100} value={service.nameEn ?? ""}
                  onChange={(e) => setService({ ...service, nameEn: e.target.value })} />
              </Field>
              <Field label={t("owner:services.description")}>
                <textarea
                  maxLength={500}
                  value={service.description}
                  onChange={(e) =>
                    setService({ ...service, description: e.target.value })
                  }
                />
              </Field>
              <Field label={t("owner:services.descriptionEn")}>
                <textarea maxLength={500} value={service.descriptionEn ?? ""}
                  onChange={(e) => setService({ ...service, descriptionEn: e.target.value })} />
              </Field>
              <div className="row">
                <button className="button" disabled={busy}>
                  {t("owner:services.save")}
                </button>
                <button type="button" onClick={() => setService(null)}>
                  {t("owner:actions.close")}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      {tab === "hours" && (
        <section className="panel">
          <h2>{t("owner:hours.title")}</h2>
          <p className="hint">
            {t("owner:hours.capacityHint")}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                () => api("/owner/business", send("PUT", profile)),
                "owner:notice.policy",
              );
            }}
          >
            <div className="form-grid">
              <Field label={t("owner:hours.capacity")}>
                <input
                  type="number"
                  required
                  min={1}
                  max={50}
                  value={profile.capacity}
                  onChange={(e) => field("capacity", Number(e.target.value))}
                />
              </Field>
              <Field label={t("owner:hours.cancellation")}>
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
            <button disabled={busy}>{t("owner:hours.savePolicy")}</button>
          </form>
          <hr />
          <h3>{t("owner:hours.weekly")}</h3>
          <p className="hint">
            {t("owner:hours.hint")}
          </p>
          {hours.map((h, i) => (
            <div className="hours-editor" key={i}>
              <select
                aria-label={t("owner:hours.day")}
                value={h.weekday}
                onChange={(e) =>
                  setHours(
                    hours.map((v, j) =>
                      j === i ? { ...v, weekday: Number(e.target.value) } : v,
                    ),
                  )
                }
              >
                {weekdays.map((_, k) => (
                  <option key={k} value={k}>
                    {weekdayName(k)}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("owner:hours.open")}
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
              <span>{t("owner:hours.to")}</span>
              <select
                aria-label={t("owner:hours.close")}
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
                aria-label={t("owner:hours.remove")}
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
              {t("owner:hours.add")}
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                action(
                  () => api("/owner/hours", send("PUT", hours)),
                  "owner:notice.hours",
                )
              }
            >
              {t("owner:hours.save")}
            </button>
          </div>
        </section>
      )}
      {tab === "blocks" && (
        <section className="panel">
          <h2>{t("owner:blocks.title")}</h2>
          <p className="hint">
            {t("owner:blocks.hint")}
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
              }, "owner:notice.blockAdded");
            }}
          >
            <div className="form-grid">
              <Field label={t("owner:blocks.from")}>
                <input
                  name="startAt"
                  type="datetime-local"
                  step={1800}
                  required
                />
              </Field>
              <Field label={t("owner:blocks.to")}>
                <input
                  name="endAt"
                  type="datetime-local"
                  step={1800}
                  required
                />
              </Field>
            </div>
            <Field label={t("owner:blocks.reason")}>
              <input
                name="reason"
                required
                maxLength={200}
                placeholder={t("owner:blocks.placeholder")}
              />
            </Field>
            <button className="button" disabled={busy}>
              {t("owner:blocks.add")}
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
                    "owner:notice.blockDeleted",
                  )
                }
              >
                {t("owner:actions.delete")}
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
