import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEvents } from "@/stores/events";
import { useReminders } from "@/stores/reminders";

export default function EventModal({ open, onClose }: { open:boolean; onClose:()=>void }){
  const { t } = useTranslation();
  const add = useEvents(s=>s.add);
  const setReminders = useReminders(s=>s.setItems);
  const events = useEvents(s=>s.events);
  const [subject,setSubject]=useState("");
  const [dueAt,setDueAt]=useState(new Date().toISOString().slice(0,16));
  if(!open) return null;
  const submit=()=>{
    if(!subject.trim()) return;
    const ev={id:Date.now().toString(), subject:subject.trim(), dueAt: new Date(dueAt).toISOString()};
    add(ev);
    setReminders([...events, ev].filter(e=> new Date(e.dueAt).getTime() < Date.now()) as any);
    setSubject(""); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="bg-white dark:bg-zinc-900 rounded-lg p-5 w-[420px] space-y-3">
        <h3 className="font-semibold">{t("create")}</h3>
        <input autoFocus value={subject} onChange={e=>setSubject(e.target.value)} placeholder={t("subject")} className="w-full border rounded px-3 py-2 text-sm" />
        <input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded">Cancel</button>
          <button onClick={submit} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded">Guardar</button>
        </div>
      </div>
    </div>
  );
}
