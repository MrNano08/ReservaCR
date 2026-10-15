import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  MapPin,
  ArrowUpRight,
  CalendarCheck,
  ShieldCheck,
  Clock3,
  SlidersHorizontal,
} from "lucide-react";
import { useLoad } from "../hooks/useLoad";
import { Business, Category } from "../types";
import { BusinessCard, ErrorBox, Loading, Empty } from "../components/UI";
import { provinces } from "../utils/format";
import { categoryLabel } from "../i18n/content";
export default function Catalog() {
  const { t } = useTranslation();
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [province, setProvince] = useState(""),
    [page, setPage] = useState(1);
  const categories = useLoad<Category[]>("/categories");
  const params = new URLSearchParams({
    page: String(page),
    ...(search ? { q: search } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(province ? { province } : {}),
  });
  const { data, loading, error } = useLoad<{
    items: Business[];
    total: number;
    pages: number;
  }>(`/businesses?${params}`);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="dot" /> {t("catalog:hero.eyebrow")}
          </span>
          <h1>
            {t("catalog:hero.first")}
            <br />
            {t("catalog:hero.more")} <em>{t("catalog:hero.time")}</em>
          </h1>
          <p>
            {t("catalog:hero.description")}
          </p>
          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              if (!q.trim() || q.length > 100) return;
              setSearch(q.trim());
              setPage(1);
            }}
          >
            <Search size={21} />
            <input
              aria-label={t("catalog:search.label")}
              placeholder={t("catalog:search.placeholder")}
              value={q}
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="search-divider" />
            <MapPin size={19} />
            <select
              aria-label={t("catalog:search.province")}
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("catalog:search.all")}</option>
              {provinces.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <button className="button" type="submit" disabled={!q.trim() || q.length > 100}>
              {t("catalog:search.submit")} <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="hero-perks">
            <span>
              <CalendarCheck size={16} />
              {t("catalog:perks.minutes")}
            </span>
            <span>
              <ShieldCheck size={16} />
              {t("catalog:perks.approved")}
            </span>
            <span>
              <Clock3 size={16} />
              {t("catalog:perks.availability")}
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="decor-ring ring-one" />
          <div className="decor-ring ring-two" />
          <div className="floating-label">
            <span className="dot" />
            {t("catalog:art.moment")}
          </div>
          <div className="calendar-art">
            <div className="calendar-top">
              <span>{t("catalog:art.appointment")}</span>
              <CalendarCheck size={24} />
            </div>
            <div className="calendar-lines">
              <span />
              <span />
              <span />
            </div>
            <div className="calendar-grid">
              {Array.from({ length: 21 }, (_, i) => (
                <span
                  className={[9, 10, 17].includes(i) ? "selected" : ""}
                  key={i}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="calendar-bottom">
              <span className="check-circle">✓</span>{t("catalog:art.day")}
            </div>
          </div>
          <span className="visual-note">{t("catalog:art.steps")}</span>
        </div>
      </section>
      <section className="catalog-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">{t("catalog:list.eyebrow")}</span>
            <h2>{t("catalog:list.title")}</h2>
          </div>
          <span className="muted">
            <SlidersHorizontal size={15} /> {t("catalog:list.explore")}
          </span>
        </div>
        <div className="chips">
          <button
            className={!category ? "chip selected" : "chip"}
            onClick={() => {
              setCategory("");
              setPage(1);
            }}
          >
            {t("catalog:list.all")}
          </button>
          {categories.data?.map((c) => (
            <button
              key={c.id}
              className={category === c.id ? "chip selected" : "chip"}
              onClick={() => {
                setCategory(c.id);
                setPage(1);
              }}
            >
              {categoryLabel(c)}
            </button>
          ))}
        </div>
        <ErrorBox message={error || categories.error} />
        {loading ? (
          <Loading />
        ) : data?.items.length ? (
          <>
            <div className="result-meta">
              {t(search ? "catalog:resultsSearch" : "catalog:results", { count: data.total, search })}
            </div>
            <div className="business-grid">
              {data.items.map((b) => (
                <BusinessCard key={b.id} business={b} />
              ))}
            </div>
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("common:actions.previous")}
              </button>
              <span>
                {t("common:pagination", { page, pages: data.pages })}
              </span>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common:actions.next")}
              </button>
            </div>
          </>
        ) : (
          !error && (
            <Empty title={t("catalog:empty.title")}>
              <p>{t("catalog:empty.description")}</p>
              <button
                onClick={() => {
                  setQ("");
                  setSearch("");
                  setCategory("");
                  setProvince("");
                  setPage(1);
                }}
              >
                {t("catalog:empty.clear")}
              </button>
            </Empty>
          )
        )}
      </section>
      <section className="business-cta">
        <div>
          <span className="eyebrow">{t("catalog:cta.eyebrow")}</span>
          <h2>{t("catalog:cta.title")}</h2>
          <p>{t("catalog:cta.description")}</p>
        </div>
        <Link className="button" to="/registro?rol=negocio">
          {t("navigation:addBusiness")} <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
