import { useTranslation } from "react-i18next";
import { useEvents } from "@/stores/events";
import { useReminders } from "@/stores/reminders";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useState, useMemo } from "react";
import EventModal from "./EventModal";
import EventCard from "./EventCard";
import CalendarMonth from "./CalendarMonth";
import { IconCalendar, IconPlus, IconSearch, IconLayoutGrid, IconList } from "@tabler/icons-react";

type Filter = "today"|"7d"|"30d"|"all"|"overdue"|"important";
type View = "list"|"calendar";

export default function Dashboard(){
  const { t } = useTranslation();
  const { events, query, setQuery, remove } = useEvents();
  const setItems = useReminders(s=>s.setItems);
  const reminders = useReminders(s=>s.items);
  const [open,setOpen]=useState(false);
  const [filter,setFilter]=useState<Filter>("all");
  const [view,setView]=useState<View>("list");
  const [sort,setSort]=useState<"due"|"importance"|"subject">("due");

  const filtered = useMemo(()=>{
    const now=new Date(); now.setHours(0,0,0,0);
    let list=[...events];
    if(query) list=list.filter(e=> e.subject.toLowerCase().includes(query.toLowerCase()) || e.notes?.toLowerCase().includes(query.toLowerCase()));
    if(filter==="today") list=list.filter(e=> new Date(e.dueAt).toDateString()===new Date().toDateString());
    if(filter==="7d"){ const end=new Date(); end.setDate(end.getDate()+7); list=list.filter(e=>{ const d=new Date(e.dueAt); return d>=now && d<=end;});}
    if(filter==="30d"){ const end=new Date(); end.setDate(end.getDate()+30); list=list.filter(e=>{ const d=new Date(e.dueAt); return d>=now && d<=end;});}
    if(filter==="overdue") list=list.filter(e=> new Date(e.dueAt).getTime()<Date.now());
    if(filter==="important") list=list.filter(e=> e.importance==="high"||e.importance==="critical");
    list.sort((a,b)=>{
      if(sort==="due") return new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime();
      if(sort==="subject") return a.subject.localeCompare(b.subject);
      const order={low:0,medium:1,high:2,critical:3};
      return order[b.importance]-order[a.importance];
    });
    return list;
  },[events,query,filter,sort]);

  const openReminders = async()=>{
    const w = await WebviewWindow.getByLabel("reminders");
    if(w){ await w.show(); await w.setFocus(); await w.setAlwaysOnTop(true); }
    setItems(events.filter(e=> new Date(e.dueAt).getTime() < Date.now()) as any);
  };

  const FilterBtn=({k,label}:{k:Filter;label:string})=><button onClick={()=>setFilter(k)} className={`px-3 py-1.5 text-xs rounded-full border ${filter===k?"bg-zinc-900 text-white border-zinc-900":"bg-white hover:bg-zinc-50"}`}>{label}</button>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><IconCalendar />{t("dashboard")}</h1>
        <button onClick={openReminders} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{t("reminders")} ({reminders.length || events.filter(e=> new Date(e.dueAt).getTime()<Date.now()).length})</button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]"><IconSearch size={16} className="absolute left-2.5 top-3 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("search")} className="w-full border rounded-lg pl-8 pr-3 py-2.5 text-sm" /></div>
        <select value={sort} onChange={e=>setSort(e.target.value as any)} className="border rounded-lg px-3 py-2.5 text-xs">
          <option value="due">Orden: vencimiento</option><option value="importance">Orden: importancia</option><option value="subject">Orden: asunto</option>
        </select>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={()=>setView("list")} className={`px-3 py-2 ${view==="list"?"bg-zinc-900 text-white":"bg-white"}`}><IconList size={16}/></button>
          <button onClick={()=>setView("calendar")} className={`px-3 py-2 ${view==="calendar"?"bg-zinc-900 text-white":"bg-white"}`}><IconLayoutGrid size={16}/></button>
        </div>
        <button onClick={()=>setOpen(true)} className="border rounded-lg px-4 py-2.5 text-sm flex items-center gap-1 hover:bg-zinc-50 bg-white"><IconPlus size={16}/>{t("create")}</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterBtn k="today" label="Hoy" /><FilterBtn k="7d" label="Próx. 7 días" /><FilterBtn k="30d" label="Próx. 30 días" /><FilterBtn k="all" label="Todos" /><FilterBtn k="overdue" label="Vencidos" /><FilterBtn k="important" label="Importantes" />
        <span className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} evento(s)</span>
      </div>

      {view==="calendar" ? (
        <CalendarMonth events={filtered} onSelectDate={(d)=>{ setFilter("today"); setQuery(""); }} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(e=>(
            <div key={e.id} className="group"><EventCard e={e} onEdit={()=>{}} onDelete={()=>remove(e.id)} /></div>
          ))}
        </div>
      )}
      {filtered.length===0 && <p className="text-sm text-muted-foreground text-center py-8">Sin resultados — prueba otro filtro</p>}
      <EventModal open={open} onClose={()=>setOpen(false)} />
    </div>
  );
}
