import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  en: { translation: {
    app: "CyberGo", reminders: "Reminders", subject: "Subject", dueIn: "Due in",
    overdue: "Overdue {{time}}", dueTime: "Due time: {{time}}",
    stopSound: "Stop Sound", openItem: "Open Item", dismiss: "Dismiss", dismissAll: "Dismiss All",
    snooze: "Snooze", alwaysOnTop: "Always on top", snoozeHint: "Click 'Snooze' to be reminded again in:",
    hours: "hour(s)", days: "day(s)", minutes: "minute(s)",
    dashboard: "Dashboard", events: "Events", create: "Create", search: "Search..."
  }},
  es: { translation: {
    app: "CyberGo", reminders: "Recordatorios", subject: "Asunto", dueIn: "Vence en",
    overdue: "Vencido hace {{time}}", dueTime: "Vencimiento: {{time}}",
    stopSound: "Silenciar", openItem: "Abrir", dismiss: "Descartar", dismissAll: "Descartar todo",
    snooze: "Posponer", alwaysOnTop: "Siempre visible", snoozeHint: "Posponer recordatorio en:",
    hours: "hora(s)", days: "día(s)", minutes: "minuto(s)",
    dashboard: "Panel", events: "Eventos", create: "Crear", search: "Buscar..."
  }}
};

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources, fallbackLng: "en", interpolation: { escapeValue: false }
});
export default i18n;
