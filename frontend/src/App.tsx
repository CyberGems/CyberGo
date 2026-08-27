import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import RemindersWindow from "./features/reminders/RemindersWindow";
import Dashboard from "./features/events/Dashboard";
import { useReminders } from "./stores/reminders";
import { Toaster } from "sonner";
import "./i18n";

export default function App() {
  const [label, setLabel] = useState("main");
  const setItems = useReminders(s=>s.setItems);

  useEffect(()=>{
    setLabel(getCurrentWindow().label);
    const mock = [
      { id:"1", subject:"CIBERCR", dueAt: new Date(Date.now()- 760*24*60*60000).toISOString() },
      { id:"2", subject:"CHORY", dueAt: new Date(Date.now()- 460*24*60*60000).toISOString() },
      { id:"3", subject:"monedas 500", dueAt: new Date(Date.now()- 85*24*60*60000).toISOString() },
      { id:"4", subject:"RESPALDO DISTRI", dueAt: new Date(Date.now()- 65*24*60*60000).toISOString() },
      { id:"5", subject:"RESPALDOS", dueAt: new Date(Date.now()- 32*24*60*60000).toISOString() },
      { id:"6", subject:"TOMAR SOL", dueAt: new Date(Date.now()- 6*24*60*60000).toISOString() },
    ];
    setItems(mock);
    const handler = (e:any) => console.log("open",e.detail);
    window.addEventListener("open-item", handler);
    return ()=> window.removeEventListener("open-item",handler);
  },[]);

  if (label === "reminders") return <><RemindersWindow /><Toaster /></>;

  return (
    <div className="min-h-screen bg-background">
      <div className="h-8 bg-zinc-900 text-white flex items-center px-3 text-xs select-none" data-tauri-drag-region>
        CyberGo — modular scaffolding listo
      </div>
      <Dashboard />
      <Toaster />
    </div>
  );
}
