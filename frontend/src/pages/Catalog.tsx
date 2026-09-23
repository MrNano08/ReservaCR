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
export default function Catalog() {
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
            <span className="dot" /> TU PRÓXIMO ESPACIO, AQUÍ
          </span>
          <h1>
            Menos vueltas.
            <br />
            Más <em>tiempo para ti.</em>
          </h1>
          <p>
            Descubre negocios cerca de ti y encuentra el momento perfecto para
            tu próxima cita.
          </p>
          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q);
              setPage(1);
            }}
          >
            <Search size={21} />
            <input
              aria-label="Buscar negocios"
              placeholder="¿Qué te gustaría reservar?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="search-divider" />
            <MapPin size={19} />
            <select
              aria-label="Provincia"
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Toda Costa Rica</option>
              {provinces.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <button className="button" type="submit">
              Buscar <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="hero-perks">
            <span>
              <CalendarCheck size={16} />
              Reserva en minutos
            </span>
            <span>
              <ShieldCheck size={16} />
              Negocios aprobados
            </span>
            <span>
              <Clock3 size={16} />
              Disponibilidad al instante
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="decor-ring ring-one" />
          <div className="decor-ring ring-two" />
          <div className="floating-label">
            <span className="dot" />
            Un momento para ti
          </div>
          <div className="calendar-art">
            <div className="calendar-top">
              <span>Tu próxima cita</span>
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
              <span className="check-circle">✓</span>Tu día, a tu ritmo.
            </div>
          </div>
          <span className="visual-note">ENCUENTRA · ELIGE · RESERVA</span>
        </div>
      </section>
      <section className="catalog-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">DESCUBRE LO LOCAL</span>
            <h2>Un buen lugar para empezar</h2>
          </div>
          <span className="muted">
            <SlidersHorizontal size={15} /> Explora a tu manera
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
            Todos los negocios
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
              {c.name}
            </button>
          ))}
        </div>
        <ErrorBox message={error || categories.error} />
        {loading ? (
          <Loading />
        ) : data?.items.length ? (
          <>
            <div className="result-meta">
              {data.total} negocios encontrados {search && `para “${search}”`}
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
                Anterior
              </button>
              <span>
                Página {page} de {data.pages}
              </span>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </>
        ) : (
          !error && (
            <Empty title="No encontramos negocios con esos filtros">
              <p>Prueba con otra categoría, ubicación o nombre.</p>
              <button
                onClick={() => {
                  setQ("");
                  setSearch("");
                  setCategory("");
                  setProvince("");
                  setPage(1);
                }}
              >
                Limpiar filtros
              </button>
            </Empty>
          )
        )}
      </section>
      <section className="business-cta">
        <div>
          <span className="eyebrow">PARA QUIENES HACEN LO LOCAL</span>
          <h2>Tu negocio. Más cerca de sus clientes.</h2>
          <p>Organiza tus servicios, horarios y reservas en un solo lugar.</p>
        </div>
        <Link className="button" to="/registro?rol=negocio">
          Agregar mi negocio <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
