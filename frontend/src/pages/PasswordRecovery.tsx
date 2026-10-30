import { useTranslation } from "react-i18next";
import { useLocalizedValidation } from "../i18n/validation";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, send } from "../services/api";
import { ErrorBox, Field } from "../components/UI";
import { passwordPattern, validSecurePassword } from "../utils/registration";
export default function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const { t, i18n } = useTranslation();
  const validation = useLocalizedValidation();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const token = params.get("token") || "";
  return <div className="auth-layout"><div className="auth-story"><h1>{t("auth:recovery.back")}{" "}<em>ReservaCR.</em></h1><p>{t("auth:recovery.description")}</p></div>
    <section className="panel auth-panel"><h2>{t(reset ? "auth:recovery.newPassword" : "auth:recovery.title")}</h2>
      {done ? <><p>{t(reset ? "auth:recovery.resetDone" : "auth:recovery.sent")}</p><Link to="/ingresar">{t("auth:recovery.login")}</Link></> : <>
        {reset && !/^[a-f0-9]{64}$/.test(token) ? <p>{t("auth:recovery.invalid")}</p> :
        <form {...validation} onSubmit={async e => {
          e.preventDefault(); setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          if (reset && !validSecurePassword(String(data.password))) { setError("validation:passwordRequirements"); return; }
          if (reset && data.password !== data.confirm) { setError("validation:passwordMismatch"); return; }
          setBusy(true);
          try { await api(reset ? "/auth/reset-password" : "/auth/forgot-password", send("POST", reset ? { token, password: data.password } : { email: data.email, language: i18n.resolvedLanguage?.split("-")[0] === "en" ? "en" : "es" })); setDone(true); }
          catch (err) { setError((err as Error).message); }
          finally { setBusy(false); }
        }}>
          {reset ? <><Field label={t("auth:recovery.newPassword")}><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} pattern={passwordPattern} required /><small className="hint">{t("validation:passwordRequirements")}</small></Field><Field label={t("auth:recovery.confirm")}><input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={72} pattern={passwordPattern} required /></Field></> : <Field label={t("auth:fields.email")}><input name="email" type="email" autoComplete="email" maxLength={190} required /></Field>}
          <ErrorBox message={error} /><button className="button full" disabled={busy || (reset && !/^[a-f0-9]{64}$/.test(token))}>{t(busy ? "common:busy" : reset ? "auth:recovery.save" : "auth:recovery.send")}</button>
        </form>}
        <p className="auth-link"><Link to={reset ? "/recuperar-contrasena" : "/ingresar"}>{t(reset ? "auth:recovery.another" : "auth:recovery.login")}</Link></p>
      </>}
    </section></div>;
}
