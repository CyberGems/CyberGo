import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useReminders } from "@/stores/reminders";
import { useState, useEffect, useRef } from "react";
import { IconBell } from "@tabler/icons-react";

export default function RemindersWindow() {
  const { t } = useTranslation();
  const { items, dismiss, dismissAll, snooze, sounding, setSounding, alwaysOnTop, setAlwaysOnTop, overdueText } = useReminders();
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null);
  const [amount, setAmount] = useState(3);
  const [unit, setUnit] = useState<"minutes"|"hours"|"days">("hours");
  const audioRef = useRef<HTMLAudioElement|null>(null);

  useEffect(()=>{ if(items[0]) setSelected(items[0].id); },[items]);

  useEffect(()=>{
    if(!sounding || items.length===0) { audioRef.current?.pause(); return; }
    const a = audioRef.current ?? new Audio("/alarm.wav");
    audioRef.current=a; a.loop=true; a.play().catch(()=>{});
    return()=>{ a.pause(); };
  },[sounding, items.length]);

  useEffect(()=>{
    if(items.length>0) setSounding(true);
  },[items.length]);

  if(items.length===0) return (
    <div className="h-screen grid place-items-center bg-zinc-50 dark:bg-zinc-900 text-sm text-muted-foreground">
      No reminders
    </div>
  );

  const toMins = ()=> unit==="minutes"?amount : unit==="hours"?amount*60 : amount*1440;
  const nextDue = items[0]?.dueAt ? new Date(items[0].dueAt).toLocaleString() : "";

  return (
    <div className="h-screen flex flex-col bg-[#f0f0f0] dark:bg-zinc-900 text-[13px] select-none">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white dark:bg-zinc-800">
        <IconBell size={16} className="text-amber-600" />
        <span className="font-bold">CIBERCR</span>
        <span className="text-muted-foreground ml-2">{t("dueTime",{time: nextDue})}</span>
      </div>

      <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900 m-2 border">
        <div className="grid grid-cols-[1fr_220px] text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border-b px-2 py-1">
          <span>{t("subject")}</span><span>{t("dueIn")}</span>
        </div>
        <AnimatePresence>
        {items.map(r=>(
          <motion.div key={r.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setSelected(r.id)}
            className={`grid grid-cols-[1fr_220px] px-2 py-1 cursor-pointer border-b last:border-0 ${selected===r.id?"bg-[#3399ff] text-white":"hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
            <span className="flex items-center gap-1 truncate"><IconBell size={12}/>{r.subject}</span>
            <span className="truncate">{overdueText(r,t)}</span>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>

      <div className="px-2 pb-2 space-y-2">
        <div className="flex gap-2">
          <button onClick={()=>setSounding(false)} className="flex-1 border rounded px-3 py-1 bg-zinc-100 hover:bg-zinc-200">{t("stopSound")}</button>
          <button onClick={()=>window.dispatchEvent(new CustomEvent("open-item",{detail:selected}))} className="flex-1 border rounded px-3 py-1 bg-zinc-100 hover:bg-zinc-200">{t("openItem")}</button>
          <button onClick={()=>selected && dismiss(selected)} className="flex-1 border rounded px-3 py-1 bg-zinc-100 hover:bg-zinc-200">{t("dismiss")}</button>
          <button onClick={dismissAll} className="flex-1 border rounded px-3 py-1 bg-zinc-100 hover:bg-zinc-200">{t("dismissAll")}</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">{t("snoozeHint")}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={amount} onChange={e=>setAmount(Number(e.target.value))} className="border rounded px-2 py-1 w-16">
            {[1,2,3,5,10,15,30].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          <select value={unit} onChange={e=>setUnit(e.target.value as any)} className="border rounded px-2 py-1">
            <option value="minutes">{t("minutes")}</option>
            <option value="hours">{t("hours")}</option>
            <option value="days">{t("days")}</option>
          </select>
          <button onClick={()=>snooze(toMins())} className="border rounded px-6 py-1 bg-zinc-100 hover:bg-zinc-200 font-semibold">{t("snooze")}</button>
          <label className="ml-auto flex items-center gap-1 text-xs">
            <input type="checkbox" checked={alwaysOnTop} onChange={e=>setAlwaysOnTop(e.target.checked)} />{t("alwaysOnTop")}
          </label>
        </div>
      </div>
    </div>
  );
}
