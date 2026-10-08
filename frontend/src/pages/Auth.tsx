import { useTranslation } from "react-i18next";
import { useLocalizedValidation } from "../i18n/validation";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarCheck, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { ErrorBox, Field } from "../components/UI";
export default function Auth({ register = false }: { register?: boolean }) {
  const { t } = useTranslation();
  const validation = useLocalizedValidation();
  const [params] = useSearchParams();
  const [role, setRole] = useState(
    params.get("rol") === "negocio" ? "BUSINESS" : "CLIENT",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const auth = useAuth(),
    navigate = useNavigate();
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <span className="eyebrow">{t("auth:story.welcome")}</span>
        <h1>
          {t("auth:story.first")}
          <br />
          {t("auth:story.second")}
          <br />
          <em>{t("auth:story.third")}</em>
        </h1>
        <p>
          {t("auth:story.local")}
          <br />
          {t("auth:story.schedule")}
        </p>
        <CalendarCheck size={100} strokeWidth={1} />
      </div>
      <section className="panel auth-panel">
        <h2>{t(register ? "auth:register.title" : "auth:login.title")}</h2>
        <p className="muted">
          {t(register ? "auth:register.description" : "auth:login.description")}
        </p>
        {register && (
          <div className="tabs">
            <button
              className={role === "CLIENT" ? "active" : ""}
              onClick={() => setRole("CLIENT")}
            >
              {t("auth:register.client")}
            </button>
            <button
              className={role === "BUSINESS" ? "active" : ""}
              onClick={() => setRole("BUSINESS")}
            >
              {t("auth:register.business")}
            </button>
          </div>
        )}
        <form
          {...validation}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const d = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const u = register
                ? await auth.register({ ...d, role })
                : await auth.login(String(d.email), String(d.password));
              const next = params.get("next");
              navigate(
                next?.startsWith("/") && !next.startsWith("//")
                  ? next
                  : u.role === "ADMIN"
                    ? "/admin"
                    : u.role === "BUSINESS"
                      ? "/negocio"
                      : "/",
              );
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <>
              <Field label={t("auth:fields.name")}>
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </Field>
              <Field label={t("auth:fields.phone")}>
                <input
                  name="phone"
                  autoComplete="tel"
                  type="tel"
                  maxLength={25}
                />
              </Field>
            </>
          )}
          <Field label={t("auth:fields.email")}>
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={190}
              required
              placeholder={t("auth:fields.emailPlaceholder")}
            />
          </Field>
          <Field label={t("auth:fields.password")}>
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 10 : 1}
              maxLength={72}
              required
              placeholder={
                register ? t("auth:fields.passwordMinimum", { min: 10 }) : t("auth:fields.passwordPlaceholder")
              }
            />
          </Field>
          <ErrorBox message={error} />
          <button className="button full" disabled={busy}>
            {t(busy ? "common:busy" : register ? "auth:register.submit" : "auth:login.submit")}
            <ArrowRight size={18} />
          </button>
        </form>
        {!register && <p className="auth-link"><Link to="/recuperar-contrasena">{t("auth:login.forgot")}</Link></p>}
        <p className="auth-link">
          {t(register ? "auth:register.existing" : "auth:login.new")}{" "}
          <Link to={register ? "/ingresar" : "/registro"}>
            {t(register ? "auth:login.link" : "auth:register.link")}
          </Link>
        </p>
      </section>
    </div>
  );
}
