import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useLoad } from "../hooks/useLoad";
import { api, send } from "../services/api";
import { PageHead, ErrorBox, Empty, Loading } from "../components/UI";
import { dateTime } from "../utils/format";
export default function Notifications() {
  const { t } = useTranslation();
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
      <PageHead eyebrow={t("notifications:eyebrow")} title={t("notifications:title")}>
        {t("notifications:description")}
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
                  {t("notifications:read")}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title={t("notifications:empty.title")}>
          <p>{t("notifications:empty.description")}</p>
        </Empty>
      )}
    </>
  );
}
