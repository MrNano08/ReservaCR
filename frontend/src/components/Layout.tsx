import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarDays, Sun, Moon, LogOut, Bell, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { ErrorBox } from "./UI";
export default function Layout() {
  const { user, logout, error } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false),
    [failure, setFailure] = useState("");
  const [light, setLight] = useState(
    () => localStorage.getItem("reservacr-theme") === "light",
  );
  document.documentElement.dataset.theme = light ? "light" : "dark";
  function theme() {
    localStorage.setItem("reservacr-theme", light ? "dark" : "light");
    setLight(!light);
  }
  return (
    <>
      <header className="header">
        <div className="nav-wrap">
          <Link to="/" className="brand">
            <span className="logo">
              <CalendarDays size={22} />
            </span>
            Reserva<span>CR</span>
          </Link>
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir menú"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav className={menu ? "open" : ""} onClick={() => setMenu(false)}>
            <NavLink to="/" end>
              Explorar
            </NavLink>
            {user?.role === "CLIENT" && (
              <NavLink to="/reservas">Mis reservas</NavLink>
            )}
            {user?.role === "BUSINESS" && (
              <>
                <NavLink to="/negocio">Mi negocio</NavLink>
                <NavLink to="/reservas">Agenda</NavLink>
              </>
            )}
            {user?.role === "ADMIN" && (
              <NavLink to="/admin">Administración</NavLink>
            )}
            {!user && (
              <Link to="/registro?rol=negocio">Agregar mi negocio</Link>
            )}
          </nav>
          <div className="nav-actions">
            <button
              className="icon-button"
              onClick={theme}
              aria-label="Cambiar tema"
            >
              {light ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            {user ? (
              <>
                <Link
                  className="icon-button"
                  to="/notificaciones"
                  aria-label="Notificaciones"
                >
                  <Bell size={19} />
                </Link>
                <span className="avatar" title={user.name}>
                  {user.name[0]}
                </span>
                <button
                  className="icon-button"
                  aria-label="Cerrar sesión"
                  onClick={async () => {
                    try {
                      await logout();
                      navigate("/");
                    } catch (e) {
                      setFailure((e as Error).message);
                    }
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="button small" to="/ingresar">
                Ingresar <span>↗</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main>
        <ErrorBox message={failure || error} />
        <Outlet />
      </main>
      <footer>
        <Link to="/" className="brand">
          Reserva<span>CR</span>
        </Link>
        <span>Tu tiempo, mejor reservado.</span>
        <small>Hecho para conectar negocios de Costa Rica.</small>
      </footer>
    </>
  );
}
