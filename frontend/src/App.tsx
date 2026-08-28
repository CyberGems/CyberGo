import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import RemindersWindow from "./features/reminders/RemindersWindow";
import Dashboard from "./features/events/Dashboard";
import Titlebar from "./components/Titlebar";
import { useReminders } from "./stores/reminders";
import { useEvents } from "./stores/events";
import { Toaster } from "sonner";
import "./i18n";

export default function App() {
  const [label, setLabel] = useState("main");
  const setItems = useReminders(s=>s.setItems);
  const events = useEvents(s=>s.events);

  useEffect(()=>{
    setLabel(getCurrentWindow().label);
    const handler = (e:any) => console.log("open",e.detail);
    window.addEventListener("open-item", handler);
    return ()=> window.removeEventListener("open-item",handler);
  },[]);

  useEffect(()=>{
    const overdue = events.filter(e=> {
      const r = useReminders.getState().items.find(x=>x.id===e.id);
      if(r?.snoozedUntil && new Date(r.snoozedUntil).getTime() > Date.now()) return false;
      return new Date(e.dueAt).getTime() < Date.now();
    });
    setItems(overdue as any);
  },[events]);

  if (label === "reminders") return <><RemindersWindow /><Toaster /></>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Titlebar title="CyberGo" />
      <div className="flex-1 overflow-auto"><Dashboard /></div>
      <Toaster />
    </div>
  );
}
