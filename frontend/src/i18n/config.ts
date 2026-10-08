import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import esCommon from "./locales/es/common.json";
import enCommon from "./locales/en/common.json";
import esNavigation from "./locales/es/navigation.json";
import enNavigation from "./locales/en/navigation.json";
import esAuth from "./locales/es/auth.json";
import enAuth from "./locales/en/auth.json";
import esCatalog from "./locales/es/catalog.json";
import enCatalog from "./locales/en/catalog.json";
import esValidation from "./locales/es/validation.json";
import enValidation from "./locales/en/validation.json";
import esErrors from "./locales/es/errors.json";
import enErrors from "./locales/en/errors.json";
import esNotifications from "./locales/es/notifications.json";
import enNotifications from "./locales/en/notifications.json";
import esBusiness from "./locales/es/business.json";
import enBusiness from "./locales/en/business.json";
import esBookings from "./locales/es/bookings.json";
import enBookings from "./locales/en/bookings.json";
import esOwner from "./locales/es/owner.json";
import enOwner from "./locales/en/owner.json";
import esAdmin from "./locales/es/admin.json";
import enAdmin from "./locales/en/admin.json";

export const languageStorageKey = "reservacr-language";
export function initialLanguage(): "es" | "en" {
  try { return localStorage.getItem(languageStorageKey) === "en" ? "en" : "es"; }
  catch { return "es"; }
}
export const locale = () => i18n.resolvedLanguage === "en" ? "en-US" : "es-CR";
function synchronize(language: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language === "en" ? "en" : "es";
    document.title = i18n.t("common:meta.title");
    document.querySelector('meta[name="description"]')?.setAttribute("content", i18n.t("common:meta.description"));
  }
  try { localStorage.setItem(languageStorageKey, language === "en" ? "en" : "es"); }
  catch { /* Storage can be unavailable; language switching still works. */ }
}
i18n.on("languageChanged", synchronize);
void i18n.use(initReactI18next).init({
  resources: {
    es: { common: esCommon, navigation: esNavigation, auth: esAuth, catalog: esCatalog, validation: esValidation, errors: esErrors, notifications: esNotifications, business: esBusiness, bookings: esBookings, owner: esOwner, admin: esAdmin },
    en: { common: enCommon, navigation: enNavigation, auth: enAuth, catalog: enCatalog, validation: enValidation, errors: enErrors, notifications: enNotifications, business: enBusiness, bookings: enBookings, owner: enOwner, admin: enAdmin },
  },
  lng: initialLanguage(),
  fallbackLng: "es",
  supportedLngs: ["es", "en"],
  defaultNS: "common",
  ns: ["common", "navigation", "auth", "catalog", "validation", "errors", "notifications", "business", "bookings", "owner", "admin"],
  initAsync: false,
  returnNull: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false }, // React escapes rendered text.
});
synchronize(i18n.resolvedLanguage || "es");
export default i18n;
