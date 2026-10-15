import { useTranslation } from "react-i18next";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
} from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Role } from "./types";
import Layout from "./components/Layout";
import { Loading, Empty } from "./components/UI";
import Catalog from "./pages/Catalog";
import Auth from "./pages/Auth";
import PasswordRecovery from "./pages/PasswordRecovery";
import BusinessDetail from "./pages/BusinessDetail";
import Bookings from "./pages/Bookings";
import Notifications from "./pages/Notifications";
const Owner = lazy(() => import("./pages/Owner"));
const Admin = lazy(() => import("./pages/Admin"));
function Protected({ roles }: { roles?: Role[] }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user)
    return (
      <Navigate
        to={`/ingresar?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  if (roles && !roles.includes(user.role))
    return (
      <Empty title={t("common:access.denied")}>
        <Link to="/">{t("common:actions.home")}</Link>
      </Empty>
    );
  return <Suspense fallback={<Loading />}><Outlet /></Suspense>;
}
function Scroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export default function App() {
  const { t } = useTranslation();
  return (
    <BrowserRouter>
      <AuthProvider>
        <Scroll />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Catalog />} />
            <Route path="ingresar" element={<Auth />} />
            <Route path="registro" element={<Auth register />} />
            <Route path="recuperar-contrasena" element={<PasswordRecovery />} />
            <Route path="restablecer-contrasena" element={<PasswordRecovery reset />} />
            <Route path="negocios/:id" element={<BusinessDetail />} />
            <Route element={<Protected roles={["CLIENT", "BUSINESS"]} />}>
              <Route path="reservas" element={<Bookings />} />
            </Route>
            <Route element={<Protected roles={["BUSINESS"]} />}>
              <Route path="negocio" element={<Owner />} />
            </Route>
            <Route element={<Protected roles={["ADMIN"]} />}>
              <Route path="admin" element={<Admin />} />
            </Route>
            <Route element={<Protected />}>
              <Route path="notificaciones" element={<Notifications />} />
            </Route>
            <Route
              path="*"
              element={
                <Empty title={t("common:access.notFound")}>
                  <Link className="button" to="/">
                    {t("common:actions.home")}
                  </Link>
                </Empty>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
