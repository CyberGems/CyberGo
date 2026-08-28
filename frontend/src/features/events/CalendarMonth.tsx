import { useMemo, useState } from "react";
import type { EventItem } from "@/stores/events";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

export default function CalendarMonth({ events, onSelectDate }: { events:EventItem[]; onSelectDate?:(d:Date)=>void }){
  const [cur,setCur]=useState(()=>{ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1);});
  const days = useMemo(()=>{
    const y=cur.getFullYear(), m=cur.getMonth();
    const first=new Date(y,m,1).getDay();
    const start=(first+6)%7;
    const dim=new Date(y,m+1,0).getDate();
    const cells:{d:Date| null; count:number}[]=[];
    for(let i=0;i<start;i++) cells.push({d:null,count:0});
    for(let d=1;d<=dim;d++){
      const date=new Date(y,m,d);
      const cnt=events.filter(e=>{ const ed=new Date(e.dueAt); return ed.getFullYear()===y && ed.getMonth()===m && ed.getDate()===d;}).length;
      cells.push({d:date,count:cnt});
    }
    return cells;
  },[cur,events]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-zinc-50 dark:bg-zinc-800">
        <button onClick={()=>setCur(new Date(cur.getFullYear(),cur.getMonth()-1,1))} className="p-1 hover:bg-zinc-200 rounded"><IconChevronLeft size={16}/></button>
        <span className="text-sm font-semibold capitalize">{cur.toLocaleDateString("es-ES",{month:"long",year:"numeric"})}</span>
        <button onClick={()=>setCur(new Date(cur.getFullYear(),cur.getMonth()+1,1))} className="p-1 hover:bg-zinc-200 rounded"><IconChevronRight size={16}/></button>
      </div>
      <div className="grid grid-cols-7 text-[11px] text-center py-1 bg-zinc-50 dark:bg-zinc-800 border-b">
        {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=><span key={d} className="font-medium text-muted-foreground">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-700">
        {days.map((c,i)=>(
          <div key={i} onClick={()=>c.d && onSelectDate?.(c.d)} className={`min-h-[68px] bg-white dark:bg-zinc-900 p-1 text-xs ${c.d?"cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-800":"bg-zinc-50 dark:bg-zinc-800/50"} ${c.count>0?"ring-1 ring-inset ring-blue-200":""}`}>
            {c.d && <><span className={`text-[11px] ${new Date().toDateString()===c.d.toDateString()?"bg-blue-600 text-white rounded-full w-5 h-5 grid place-items-center":""}`}>{c.d.getDate()}</span>{c.count>0 && <span className="mt-1 block text-[10px] bg-blue-600 text-white rounded px-1 truncate">{c.count} evento(s)</span>}</>}
          </div>
        ))}
      </div>
    </div>
  );
}
