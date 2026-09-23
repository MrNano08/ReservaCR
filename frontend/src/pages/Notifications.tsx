import { useState } from "react";
import { Bell } from "lucide-react";
import { useLoad } from "../hooks/useLoad";
import { api, send } from "../services/api";
import { PageHead, ErrorBox, Empty, Loading } from "../components/UI";
import { dateTime } from "../utils/format";
export default function Notifications() {
  const { data, loading, error, reload } = useLoad<
    {
      id: string;
      subject: string;
      body: string;
      read: boolean;
      createdAt: string;
    }[]
  >("/notifications");
  const [failure, setFailure] = useState("");
  return (
    <>
      <PageHead eyebrow="AL DÍA" title="Tus notificaciones">
        Confirmaciones y cambios de tus citas, siempre a mano.
      </PageHead>
      <ErrorBox message={error || failure} />
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="notification-list">
          {data.map((n) => (
            <article
              key={n.id}
              className={`panel notification ${n.read ? "read" : ""}`}
            >
              {" "}
              <Bell size={22} />
              <div>
                <h3>{n.subject}</h3>
                <small>{dateTime(n.createdAt)}</small>
                <p className="pre-line">{n.body}</p>
              </div>
              {!n.read && (
                <button
                  onClick={async () => {
                    try {
                      await api(`/notifications/${n.id}/read`, send("PATCH"));
                      reload();
                    } catch (e) {
                      setFailure((e as Error).message);
                    }
                  }}
                >
                  Marcar leída
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Todo tranquilo por aquí">
          <p>Tus notificaciones aparecerán cuando reserves una cita.</p>
        </Empty>
      )}
    </>
  );
}
