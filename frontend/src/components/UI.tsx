import { ReactNode, useState, Children, isValidElement } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../i18n/errors";
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
import { bilingualText, categoryLabel } from "../i18n/content";
export function ErrorBox({ message }: { message: string }) {
  useTranslation();
  return message ? (
    <div className="alert error" role="alert">
      <AlertCircle size={18} />
      {errorMessage(message)}
    </div>
  ) : null;
}
export function Loading() {
  const { t } = useTranslation();
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      {t("common:loading")}
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
  const { t, i18n } = useTranslation();
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      {i18n.exists(`common:status.${value}`) ? t(`common:status.${value}`) : value}
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
  const control = Children.toArray(children).find(
    child => isValidElement(child) && (child.type === "input" || child.type === "textarea"),
  );
  const props = isValidElement<{ value?: string; maxLength?: number }>(control) ? control.props : undefined;
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {props?.maxLength && (
        <CharacterLimit
          max={props.maxLength}
          current={isValidElement(control) && control.type === "textarea" ? props.value?.length ?? 0 : undefined}
        />
      )}
    </label>
  );
}
export function CharacterLimit({ max, current }: { max: number; current?: number }) {
  const { t } = useTranslation();
  return (
    <small className="hint character-limit" title={t("validation:characterLimit", { max })}>
      {current === undefined ? t("validation:characterLimit", { max }) : `${current} / ${max}`}
    </small>
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
  useTranslation();
  const cat = categoryLabel(business.category);
  const code = business.category?.code;
  const Icon =
    code === "barber"
      ? Scissors
      : code === "health"
        ? HeartPulse
        : code === "wellness"
          ? Leaf
          : Sparkles;
  return (
    <div
      className={`business-art ${large ? "large" : ""} tone-${code === "barber" ? 2 : code === "health" ? 3 : code === "wellness" ? 4 : 1}`}
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
  const { t } = useTranslation();
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
        <p className="clamp">{bilingualText(b.description, b.descriptionEn)}</p>
        <div className="card-bottom">
          <span className="dot" />
          {t("common:business.online")}<span>{t("common:business.services")}</span>
        </div>
      </div>
    </Link>
  );
}
