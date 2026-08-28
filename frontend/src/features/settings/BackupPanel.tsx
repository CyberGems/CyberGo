import { useEvents } from "@/stores/events";
import { useTrash } from "@/stores/trash";
import { IconDownload, IconUpload } from "@tabler/icons-react";
import { useRef } from "react";

export default function BackupPanel(){
  const events = useEvents(s=>s.events);
  const trashed = useTrash(s=>s.trashed);
  const add = useEvents(s=>s.add);
  const ref=useRef<HTMLInputElement>(null);

  const exportJson=()=>{
    const data=JSON.stringify({events, trashed, exportedAt:new Date().toISOString()},null,2);
    const blob=new Blob([data],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`cybergo-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importJson=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const j=JSON.parse(reader.result as string);
        if(j.events?.length){ j.events.forEach((ev:any)=> add(ev)); alert(`Importados ${j.events.length} eventos`); }
      }catch{ alert("JSON inválido");}
    };
    reader.readAsText(f);
  };
  return (
    <div className="flex gap-2">
      <button onClick={exportJson} className="flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg bg-white hover:bg-zinc-50"><IconDownload size={14}/> Exportar</button>
      <button onClick={()=>ref.current?.click()} className="flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg bg-white hover:bg-zinc-50"><IconUpload size={14}/> Importar</button>
      <input ref={ref} type="file" accept=".json" className="hidden" onChange={importJson}/>
    </div>
  );
}
