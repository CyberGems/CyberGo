import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { IconCalendar, IconPlus, IconSearch, IconTrash, IconPencil } from "@tabler/icons-react";
import { useEvents } from "@/stores/events";
import { useReminders } from "@/stores/reminders";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useState, useMemo } from "react";
import EventModal from "./EventModal";

export default function Dashboard(){
  const { t } = useTranslation();
  const { events, query, setQuery, remove } = useEvents();
  const setItems = useReminders(s=>s.setItems);
  const reminders = useReminders(s=>s.items);
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [editVal,setEditVal]=useState("");

  const filtered = useMemo(()=> events.filter(e=> e.subject.toLowerCase().includes(query.toLowerCase())),[events,query]);

  const openReminders = async()=>{
    const w = await WebviewWindow.getByLabel("reminders");
    if(w){ await w.show(); await w.setFocus(); await w.setAlwaysOnTop(true); }
    const overdue = events.filter(e=> new Date(e.dueAt).getTime() < Date.now());
    setItems(overdue as any);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><IconCalendar />{t("dashboard")}</h1>
        <button onClick={openReminders} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">{t("reminders")} ({reminders.length || events.filter(e=> new Date(e.dueAt).getTime()<Date.now()).length})</button>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><IconSearch size={16} className="absolute left-2.5 top-3 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("search")} className="w-full border rounded pl-8 pr-3 py-2.5 text-sm" /></div>
        <button onClick={()=>setOpen(true)} className="border rounded px-4 py-2 text-sm flex items-center gap-1 hover:bg-zinc-50"><IconPlus size={16}/>{t("create")}</button>
      </div>
      <div className="grid gap-2">
        {filtered.map(r=>(
          <motion.div key={r.id} layout initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className="border rounded-lg p-3 bg-card flex justify-between items-center group">
            {editing===r.id ? (
              <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={()=>{ useEvents.getState().update(r.id,{subject:editVal}); setEditing(null);}} onKeyDown={e=>{ if(e.key==="Enter"){ useEvents.getState().update(r.id,{subject:editVal}); setEditing(null);} if(e.key==="Escape") setEditing(null);}} className="border rounded px-2 py-1 text-sm flex-1 mr-3"/>
            ) : (
              <span className="font-medium truncate cursor-pointer" onDoubleClick={()=>{setEditing(r.id); setEditVal(r.subject);}}>{r.subject}</span>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{new Date(r.dueAt).toLocaleString()}</span>
              <button onClick={()=>{setEditing(r.id); setEditVal(r.subject);}} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded"><IconPencil size={14}/></button>
              <button onClick={()=>remove(r.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-red-600 rounded"><IconTrash size={14}/></button>
            </div>
          </motion.div>
        ))}
        {filtered.length===0 && <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>}
      </div>
      <EventModal open={open} onClose={()=>setOpen(false)} />
    </div>
  );
}
