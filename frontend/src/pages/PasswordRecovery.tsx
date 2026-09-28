import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, send } from "../services/api";
import { ErrorBox, Field } from "../components/UI";
export default function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const token = params.get("token") || "";
  return <div className="auth-layout"><div className="auth-story"><h1>Vuelve a <em>ReservaCR.</em></h1><p>Recupera el acceso a tu cuenta de forma segura.</p></div>
    <section className="panel auth-panel"><h2>{reset ? "Nueva contraseña" : "Recuperar contraseña"}</h2>
      {done ? <><p>{reset ? "Tu contraseña se cambió. Ingresa con la nueva contraseña." : "Si el correo está registrado, recibirás un enlace para cambiar tu contraseña. Revisa también el correo no deseado."}</p><Link to="/ingresar">Volver al ingreso</Link></> : <>
        {reset && !/^[a-f0-9]{64}$/.test(token) ? <p>El enlace no es válido. Solicita uno nuevo.</p> :
        <form onSubmit={async e => {
          e.preventDefault(); setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          if (reset && data.password !== data.confirm) { setError("Las contraseñas no coinciden."); return; }
          setBusy(true);
          try { await api(reset ? "/auth/reset-password" : "/auth/forgot-password", send("POST", reset ? { token, password: data.password } : { email: data.email })); setDone(true); }
          catch (err) { setError((err as Error).message); }
          finally { setBusy(false); }
        }}>
          {reset ? <><Field label="Nueva contraseña"><input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></Field><Field label="Confirmar contraseña"><input name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></Field></> : <Field label="Correo electrónico"><input name="email" type="email" autoComplete="email" maxLength={190} required /></Field>}
          <ErrorBox message={error} /><button className="button full" disabled={busy || (reset && !/^[a-f0-9]{64}$/.test(token))}>{busy ? "Un momento…" : reset ? "Guardar contraseña" : "Enviar enlace"}</button>
        </form>}
        <p className="auth-link"><Link to={reset ? "/recuperar-contrasena" : "/ingresar"}>{reset ? "Solicitar otro enlace" : "Volver al ingreso"}</Link></p>
      </>}
    </section></div>;
}
