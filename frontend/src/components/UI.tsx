import { ReactNode, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  LoaderCircle,
  MapPin,
  Scissors,
  HeartPulse,
  Sparkles,
  Leaf,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Business } from "../types";
import { labels } from "../utils/format";
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="alert error" role="alert">
      <AlertCircle size={18} />
      {message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      Cargando…
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <CalendarDays size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      {labels[value] || value}
    </span>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
export function BusinessArt({
  business,
  large = false,
}: {
  business: Business;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const cat = business.category?.name || "";
  const Icon =
    cat === "Barbería"
      ? Scissors
      : cat === "Salud"
        ? HeartPulse
        : cat === "Bienestar"
          ? Leaf
          : Sparkles;
  return (
    <div
      className={`business-art ${large ? "large" : ""} tone-${cat === "Barbería" ? 2 : cat === "Salud" ? 3 : cat === "Bienestar" ? 4 : 1}`}
    >
      {business.imageUrl && !failed ? (
        <img
          src={business.imageUrl}
          alt={business.name}
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <div className="art-orbit" />
          <Icon className="art-icon" strokeWidth={1} />
          <span className="art-letter">
            {business.name.split(" ").slice(-1)[0]}
          </span>
        </>
      )}
      <span className="art-category">{cat}</span>
    </div>
  );
}
export function BusinessCard({ business: b }: { business: Business }) {
  return (
    <Link className="business-card" to={`/negocios/${b.id}`}>
      <BusinessArt business={b} />
      <div className="card-content">
        <div className="row between">
          <h3>{b.name}</h3>
          <ArrowUpRight size={20} />
        </div>
        <p className="location">
          <MapPin size={14} />
          {b.canton}, {b.province}
        </p>
        <p className="clamp">{b.description}</p>
        <div className="card-bottom">
          <span className="dot" />
          Reservas en línea<span>Ver servicios →</span>
        </div>
      </div>
    </Link>
  );
}
