import { useTranslation } from "react-i18next";
import { useEvents } from "@/stores/events";
import { useReminders } from "@/stores/reminders";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useState, useMemo } from "react";
import EventModal from "./EventModal";
import EventCard from "./EventCard";
import { IconCalendar, IconPlus, IconSearch } from "@tabler/icons-react";

export default function Dashboard(){
  const { t } = useTranslation();
  const { events, query, setQuery, remove } = useEvents();
  const setItems = useReminders(s=>s.setItems);
  const reminders = useReminders(s=>s.items);
  const [open,setOpen]=useState(false);
  const filtered = useMemo(()=> events.filter(e=> e.subject.toLowerCase().includes(query.toLowerCase())),[events,query]);
  const openReminders = async()=>{
    const w = await WebviewWindow.getByLabel("reminders");
    if(w){ await w.show(); await w.setFocus(); await w.setAlwaysOnTop(true); }
    setItems(events.filter(e=> new Date(e.dueAt).getTime() < Date.now()) as any);
  };
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><IconCalendar />{t("dashboard")}</h1>
        <button onClick={openReminders} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">{t("reminders")} ({reminders.length || events.filter(e=> new Date(e.dueAt).getTime()<Date.now()).length})</button>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><IconSearch size={16} className="absolute left-2.5 top-3 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("search")} className="w-full border rounded-lg pl-8 pr-3 py-2.5 text-sm" /></div>
        <button onClick={()=>setOpen(true)} className="border rounded-lg px-4 py-2 text-sm flex items-center gap-1 hover:bg-zinc-50"><IconPlus size={16}/>{t("create")}</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(e=>(
          <div key={e.id} className="group"><EventCard e={e} onEdit={()=>{}} onDelete={()=>remove(e.id)} /></div>
        ))}
      </div>
      {filtered.length===0 && <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>}
      <EventModal open={open} onClose={()=>setOpen(false)} />
    </div>
  );
}
