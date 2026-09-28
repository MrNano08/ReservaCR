import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarCheck, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { ErrorBox, Field } from "../components/UI";
export default function Auth({ register = false }: { register?: boolean }) {
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
        <span className="eyebrow">BIENVENIDO A RESERVACR</span>
        <h1>
          Tu próximo
          <br />
          buen momento
          <br />
          <em>empieza aquí.</em>
        </h1>
        <p>
          Negocios locales. Horarios claros.
          <br />
          Una agenda que se adapta a ti.
        </p>
        <CalendarCheck size={100} strokeWidth={1} />
      </div>
      <section className="panel auth-panel">
        <h2>{register ? "Crea tu cuenta" : "Qué bueno verte"}</h2>
        <p className="muted">
          {register
            ? "Elige cómo quieres usar ReservaCR."
            : "Ingresa para gestionar tus próximas citas."}
        </p>
        {register && (
          <div className="tabs">
            <button
              className={role === "CLIENT" ? "active" : ""}
              onClick={() => setRole("CLIENT")}
            >
              Quiero reservar
            </button>
            <button
              className={role === "BUSINESS" ? "active" : ""}
              onClick={() => setRole("BUSINESS")}
            >
              Tengo un negocio
            </button>
          </div>
        )}
        <form
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
              <Field label="Nombre completo">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  name="phone"
                  autoComplete="tel"
                  type="tel"
                  maxLength={25}
                />
              </Field>
            </>
          )}
          <Field label="Correo electrónico">
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={190}
              required
              placeholder="tu@correo.com"
            />
          </Field>
          <Field label="Contraseña">
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 10 : 1}
              maxLength={72}
              required
              placeholder={
                register ? "Al menos 10 caracteres" : "Tu contraseña"
              }
            />
          </Field>
          <ErrorBox message={error} />
          <button className="button full" disabled={busy}>
            {busy ? "Un momento…" : register ? "Crear cuenta" : "Ingresar"}
            <ArrowRight size={18} />
          </button>
        </form>
        {!register && <p className="auth-link"><Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link></p>}
        <p className="auth-link">
          {register ? "¿Ya tienes cuenta?" : "¿Todavía no tienes cuenta?"}{" "}
          <Link to={register ? "/ingresar" : "/registro"}>
            {register ? "Ingresa" : "Regístrate"}
          </Link>
        </p>
      </section>
    </div>
  );
}
