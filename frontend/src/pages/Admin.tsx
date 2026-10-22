import { useTranslation } from "react-i18next";
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
  CharacterLimit,
} from "../components/UI";
import { dateTime, money, weekdayName, minuteTime } from "../utils/format";
import { bilingualText, categoryLabel, categoryCodes } from "../i18n/content";
export default function Admin() {
  const { t } = useTranslation("admin");
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
      <PageHead eyebrow={t("admin:head.eyebrow")} title={t("admin:head.title")}>
        {t("admin:head.description")}
      </PageHead>
      <div className="tabs owner-tabs">
        {[
          ["businesses", t("admin:tabs.businesses")],
          ["categories", t("admin:tabs.categories")],
          ["mail", t("admin:tabs.mail")],
          ["audit", t("admin:tabs.audit")],
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
            <h2>{t("admin:businesses.title")}</h2>
            <select
              aria-label={t("admin:filters.label")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">{t("admin:filters.all")}</option>
              <option value="PENDING">{t("admin:filters.pending")}</option>
              <option value="APPROVED">{t("admin:filters.approved")}</option>
              <option value="REJECTED">{t("admin:filters.rejected")}</option>
              <option value="SUSPENDED">{t("admin:filters.suspended")}</option>
            </select>
          </div>
          {businesses.loading ? (
            <Loading />
          ) : businesses.data?.length ? (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("admin:table.business")}</th>
                    <th>{t("admin:table.location")}</th>
                    <th>{t("admin:table.status")}</th>
                    <th>{t("admin:table.publication")}</th>
                    <th>{t("admin:table.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.data
                    .filter((b) => filter === "ALL" || b.status === filter)
                    .map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.name}</strong>
                          <small>{categoryLabel(b.category)}</small>
                        </td>
                        <td>{b.canton}</td>
                        <td>
                          <Badge value={b.status} />
                        </td>
                        <td>{b.published ? t("admin:publication.visible") : t("admin:publication.hidden")}</td>
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
                            {t("admin:actions.review")}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title={t("admin:businesses.empty")} />
          )}
        </>
      )}
      {tab === "categories" && (
        <section className="panel">
          <h2>{t("admin:categories.title")}</h2>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const name = data.get("name"), code = data.get("code") || null;
              void action(async () => {
                await api("/admin/categories", send("POST", { name, code }));
                form.reset();
              });
            }}
          >
            <div className="limit-control category-limit-control">
              <input
                aria-label={t("admin:categories.new")}
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder={t("admin:categories.placeholder")}
              />
              <CharacterLimit max={80} />
            </div>
            <select name="code" aria-label={t("admin:categories.translation")}>
              <option value="">{t("admin:categories.original")}</option>
              {categoryCodes.map((code) => <option key={code} value={code}>{t(`common:categories.${code}`)}</option>)}
            </select>
            <button className="button" disabled={busy}>
              {t("admin:actions.add")}
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
                        code: d.get("code") || null,
                        active: d.get("active") === "on",
                      }),
                    ),
                  );
                }}
              >
                <div className="limit-control">
                  <input
                    name="name"
                    aria-label={t("admin:categories.name")}
                    defaultValue={c.name}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                  <CharacterLimit max={80} />
                </div>
                <select name="code" defaultValue={c.code ?? ""}
                  aria-label={t("admin:categories.translation")}>
                  <option value="">{t("admin:categories.original")}</option>
                  {categoryCodes.map((code) => <option key={code} value={code}>{t(`common:categories.${code}`)}</option>)}
                </select>
                <label className="row">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={c.active}
                  />
                  {t("admin:categories.active")}
                </label>
                <button disabled={busy}>{t("admin:actions.save")}</button>
              </form>
            ))
          )}
          <p className="hint">
            {t("admin:categories.hint")}
          </p>
        </section>
      )}
      {tab === "mail" && (
        <section className="panel">
          <h2>{t("admin:mail.title")}</h2>
          <p className="hint">
            {t("admin:mail.hint")}
          </p>
          {jobs.loading ? (
            <Loading />
          ) : (
            jobs.data?.map((j) => (
              <div className="management-row" key={j.id}>
                <div>
                  <strong>{j.subject}</strong>
                  <p>
                    {dateTime(j.createdAt)} · {t("admin:mail.attempts", { count: j.attempts })}
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
                    {t("admin:actions.retry")}
                  </button>
                )}
              </div>
            ))
          )}
        </section>
      )}
      {tab === "audit" && (
        <section className="panel table-scroll">
          <h2>{t("admin:audit.title")}</h2>
          {audit.loading ? (
            <Loading />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("admin:table.date")}</th>
                  <th>{t("admin:table.action")}</th>
                  <th>{t("admin:table.resource")}</th>
                  <th>{t("admin:table.detail")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.data?.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.createdAt)}</td>
                    <td>
                      {(
                        {
                          BUSINESS_APPROVED: t("admin:audit.actions.BUSINESS_APPROVED"),
                          BUSINESS_REJECTED: t("admin:audit.actions.BUSINESS_REJECTED"),
                          BUSINESS_SUSPENDED: t("admin:audit.actions.BUSINESS_SUSPENDED"),
                          CATEGORY_CREATE: t("admin:audit.actions.CATEGORY_CREATE"),
                          CATEGORY_UPDATE: t("admin:audit.actions.CATEGORY_UPDATE"),
                          BOOKING_CONFIRMED: t("admin:audit.actions.BOOKING_CONFIRMED"),
                          BOOKING_CANCELLED: t("admin:audit.actions.BOOKING_CANCELLED"),
                          BOOKING_COMPLETED: t("admin:audit.actions.BOOKING_COMPLETED"),
                          BOOKING_NO_SHOW: t("admin:audit.actions.BOOKING_NO_SHOW"),
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
              <button onClick={() => setSelected(null)}>{t("admin:actions.close")}</button>
            </div>
            <Badge value={selected.status} />
            <p>{bilingualText(selected.description, selected.descriptionEn)}</p>
            <p>
              {selected.address} · {selected.canton}, {selected.province}
            </p>
            <p>
              {t("admin:review.contact", { phone: selected.phone, capacity: selected.capacity })}
            </p>
            <h3>{t("admin:review.services")}</h3>
            {selected.services.map((s) => (
              <p key={s.id}>
                {bilingualText(s.name, s.nameEn)} · {t("admin:review.duration", { minutes: s.duration })} · {money(s.price)}
                <small>{bilingualText(s.description, s.descriptionEn)}</small>
              </p>
            ))}
            <h3>{t("admin:review.hours")}</h3>
            {selected.hours.map((h, i) => (
              <p key={i}>
                {weekdayName(h.weekday)}: {minuteTime(h.startMinute)} –{" "}
                {minuteTime(h.endMinute)}
              </p>
            ))}
            <Field label={t("admin:review.notes")}>
              <textarea
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <ErrorBox message={error} />
            <div className="row wrap">
              {[
                ["APPROVED", t("admin:actions.approve")],
                ["REJECTED", t("admin:actions.reject")],
                ["SUSPENDED", t("admin:actions.suspend")],
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
