import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { IconCalendar, IconPlus, IconSearch } from "@tabler/icons-react";
import { useReminders } from "@/stores/reminders";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export default function Dashboard(){
  const { t } = useTranslation();
  const items = useReminders(s=>s.items);

  const openReminders = async()=>{
    const w = await WebviewWindow.getByLabel("reminders");
    if(w){ await w.show(); await w.setFocus(); await w.setAlwaysOnTop(true); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><IconCalendar />{t("dashboard")}</h1>
        <button onClick={openReminders} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm">{t("reminders")} ({items.length})</button>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><IconSearch size={16} className="absolute left-2 top-2.5 text-muted-foreground"/><input placeholder={t("search")} className="w-full border rounded pl-8 pr-3 py-2 text-sm" /></div>
        <button className="border rounded px-4 py-2 text-sm flex items-center gap-1"><IconPlus size={16}/>{t("create")}</button>
      </div>
      <div className="grid gap-3">
        {items.map(r=>(
          <motion.div key={r.id} layout className="border rounded p-3 bg-card flex justify-between">
            <span className="font-medium">{r.subject}</span>
            <span className="text-xs text-muted-foreground">{new Date(r.dueAt).toLocaleString()}</span>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Ventana Reminders: siempre visible (alwaysOnTop), no se autocierra, agrupada en tabla, sonido en loop hasta Stop Sound/Dismiss/Snooze.</p>
    </div>
  );
}
