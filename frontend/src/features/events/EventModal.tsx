import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEvents, type Importance, type Recurrence, type Alarm } from "@/stores/events";
import { useReminders } from "@/stores/reminders";

type Tab = "general"|"alarm"|"recur"|"attach";
export default function EventModal({ open, onClose }: { open:boolean; onClose:()=>void }){
  const { t } = useTranslation();
  const add = useEvents(s=>s.add);
  const events = useEvents(s=>s.events);
  const setReminders = useReminders(s=>s.setItems);
  const [tab,setTab]=useState<Tab>("general");
  const [subject,setSubject]=useState("");
  const [dueAt,setDueAt]=useState(new Date().toISOString().slice(0,16));
  const [importance,setImportance]=useState<Importance>("medium");
  const [notes,setNotes]=useState("");
  const [alarm,setAlarm]=useState<Alarm>({enabled:true, beforeMinutes:15});
  const [recur,setRecur]=useState<Recurrence>({kind:"none", interval:1});
  const [attach,setAttach]=useState("");
  const [attachments,setAttachments]=useState<string[]>([]);
  if(!open) return null;
  const submit=()=>{
    if(!subject.trim()) return;
    const ev={id:Date.now().toString(), subject:subject.trim(), dueAt:new Date(dueAt).toISOString(),
      importance, recurrence:recur, alarm, attachments, tags:[], notes, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
    add(ev as any);
    const overdue=[...events, ev].filter(e=> new Date(e.dueAt).getTime() < Date.now());
    setReminders(overdue as any);
    setSubject(""); setNotes(""); setAttachments([]); onClose();
  };
  const TabBtn=({k,label}:{k:Tab;label:string})=><button onClick={()=>setTab(k)} className={`px-3 py-1.5 text-xs rounded ${tab===k?"bg-blue-600 text-white":"bg-zinc-100 hover:bg-zinc-200"}`}>{label}</button>;
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="bg-white dark:bg-zinc-900 rounded-xl w-[560px] max-w-full shadow-xl overflow-hidden">
        <div className="px-5 py-3 border-b flex justify-between items-center">
          <h3 className="font-semibold text-sm">{t("create")} — Efficient Reminder moderno</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="px-5 py-3 flex gap-2 border-b bg-zinc-50 dark:bg-zinc-800/50">
          <TabBtn k="general" label="General" /><TabBtn k="alarm" label="Alarma" /><TabBtn k="recur" label="Recurrencia" /><TabBtn k="attach" label="Adjuntos" />
        </div>
        <div className="p-5 space-y-3 min-h-[260px]">
          {tab==="general" && <>
            <input autoFocus value={subject} onChange={e=>setSubject(e.target.value)} placeholder={t("subject")} className="w-full border rounded-lg px-3 py-2.5 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              <select value={importance} onChange={e=>setImportance(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
              </select>
            </div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Comentarios / notas..." rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </>}
          {tab==="alarm" && <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alarm.enabled} onChange={e=>setAlarm({...alarm, enabled:e.target.checked})}/> Activar alarma</label>
            <div className="flex items-center gap-2">
              <span className="text-sm">Avisar</span>
              <select value={alarm.beforeMinutes} onChange={e=>setAlarm({...alarm, beforeMinutes:Number(e.target.value)})} className="border rounded px-2 py-1 text-sm">
                {[0,5,15,30,60,1440].map(n=><option key={n} value={n}>{n} min antes</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Sonará en popup permanente hasta Dismiss/Snooze (como captura).</p>
          </>}
          {tab==="recur" && <>
            <select value={recur.kind} onChange={e=>setRecur({...recur, kind:e.target.value as any})} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="none">Sin recurrencia</option><option value="daily">Diario</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option><option value="custom">Personalizado</option>
            </select>
            {recur.kind!=="none" && recur.kind!=="custom" && <div className="flex gap-2 items-center"><span className="text-sm">Cada</span><input type="number" min={1} value={recur.interval??1} onChange={e=>setRecur({...recur, interval:Number(e.target.value)})} className="border rounded w-20 px-2 py-1 text-sm"/>{recur.kind}</div>}
            {recur.kind==="custom" && <input value={recur.customRule??""} onChange={e=>setRecur({...recur, customRule:e.target.value})} placeholder="RRULE: FREQ=WEEKLY;BYDAY=MO" className="w-full border rounded px-3 py-2 text-sm" />}
          </>}
          {tab==="attach" && <>
            <div className="flex gap-2"><input value={attach} onChange={e=>setAttach(e.target.value)} placeholder="Ruta / URL adjunto" className="flex-1 border rounded-lg px-3 py-2 text-sm"/><button onClick={()=>{ if(attach.trim()){ setAttachments([...attachments, attach.trim()]); setAttach("");}}} className="px-3 py-2 bg-zinc-900 text-white rounded-lg text-sm">Añadir</button></div>
            <ul className="text-xs space-y-1">{attachments.map((a,i)=><li key={i} className="flex justify-between border rounded px-2 py-1">{a}<button onClick={()=>setAttachments(attachments.filter((_,j)=>j!==i))} className="text-red-600">x</button></li>)}</ul>
          </>}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2 bg-zinc-50 dark:bg-zinc-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancelar</button>
          <button onClick={submit} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar</button>
        </div>
      </div>
    </div>
  );
}
