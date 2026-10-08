import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarDays, Sun, Moon, LogOut, Bell, Menu, X, Accessibility } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { LanguageSelector } from "./LanguageSelector";
import { ErrorBox } from "./UI";
export default function Layout() {
  const { t } = useTranslation();
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
            aria-label={t(menu ? "navigation:menu.close" : "navigation:menu.open")} aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav className={menu ? "open" : ""} onClick={() => setMenu(false)}>
            <NavLink to="/" end>
              {t("navigation:explore")}
            </NavLink>
            {user?.role === "CLIENT" && (
              <NavLink to="/reservas">{t("navigation:bookings")}</NavLink>
            )}
            {user?.role === "BUSINESS" && (
              <>
                <NavLink to="/negocio">{t("navigation:business")}</NavLink>
                <NavLink to="/reservas">{t("navigation:schedule")}</NavLink>
              </>
            )}
            {user?.role === "ADMIN" && (
              <NavLink to="/admin">{t("navigation:admin")}</NavLink>
            )}
            {!user && (
              <Link to="/registro?rol=negocio">{t("navigation:addBusiness")}</Link>
            )}
          </nav>
          <div className="nav-actions">
            <LanguageSelector />
            <button
              className="icon-button"
              onClick={theme}
              aria-label={t("navigation:theme")}
            >
              {light ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            {user ? (
              <>
                <Link
                  className="icon-button"
                  to="/notificaciones"
                  aria-label={t("navigation:notifications")}
                >
                  <Bell size={19} />
                </Link>
                <span className="avatar" title={user.name}>
                  {user.name[0]}
                </span>
                <button
                  className="icon-button"
                  aria-label={t("navigation:logout")}
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
                {t("navigation:login")}<span>↗</span>
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
        <span>{t("navigation:footer.tagline")}</span>
        <small>{t("navigation:footer.description")}</small>
      </footer>
      {import.meta.env.VITE_USERWAY_ACCOUNT_ID?.trim() && (
        <button
          id="userway-widget-trigger"
          type="button"
          className="userway-trigger"
          aria-label={t("navigation:accessibility")}
          title={t("navigation:accessibility")}
          aria-haspopup="dialog"
        >
          <Accessibility size={26} />
        </button>
      )}
    </>
  );
}
