import { useTranslation } from "react-i18next";
export function LanguageSelector() {
  const { t, i18n } = useTranslation("common");
  return <select className="language-selector" aria-label={t("language.label")}
    value={i18n.resolvedLanguage === "en" ? "en" : "es"}
    onChange={event => { void i18n.changeLanguage(event.target.value); }}>
    <option value="es" lang="es">Español</option>
    <option value="en" lang="en">English</option>
  </select>;
}
