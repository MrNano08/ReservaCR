import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Role } from "./types";
import Layout from "./components/Layout";
import { Loading, Empty } from "./components/UI";
import Catalog from "./pages/Catalog";
import Auth from "./pages/Auth";
import PasswordRecovery from "./pages/PasswordRecovery";
import BusinessDetail from "./pages/BusinessDetail";
import Bookings from "./pages/Bookings";
import Owner from "./pages/Owner";
import Admin from "./pages/Admin";
import Notifications from "./pages/Notifications";
function Protected({ roles }: { roles?: Role[] }) {
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
      <Empty title="No tienes acceso a esta sección">
        <Link to="/">Volver al inicio</Link>
      </Empty>
    );
  return <Outlet />;
}
function Scroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export default function App() {
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
                <Empty title="Esta página no existe">
                  <Link className="button" to="/">
                    Volver al inicio
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
