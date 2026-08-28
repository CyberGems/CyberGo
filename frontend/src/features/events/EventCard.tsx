import type { EventItem } from "@/stores/events";
import { IconRepeat, IconBell, IconPaperclip, IconFlag } from "@tabler/icons-react";
const impColor:Record<string,string>={low:"bg-zinc-100 text-zinc-600",medium:"bg-blue-100 text-blue-700",high:"bg-amber-100 text-amber-700",critical:"bg-red-100 text-red-700"};
export default function EventCard({ e, onEdit, onDelete }: { e:EventItem; onEdit:()=>void; onDelete:()=>void }){
  return (
    <div className="border rounded-xl p-3 bg-card flex flex-col gap-1 hover:shadow-sm transition">
      <div className="flex justify-between items-start gap-2">
        <span className="font-medium text-sm truncate">{e.subject}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0 ${impColor[e.importance]}`}><IconFlag size={10}/>{e.importance}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span>{new Date(e.dueAt).toLocaleString()}</span>
        {e.recurrence.kind!=="none" && <span className="flex items-center gap-1"><IconRepeat size={12}/>{e.recurrence.kind}</span>}
        {e.alarm.enabled && <span className="flex items-center gap-1"><IconBell size={12}/>{e.alarm.beforeMinutes}m</span>}
        {e.attachments.length>0 && <span className="flex items-center gap-1"><IconPaperclip size={12}/>{e.attachments.length}</span>}
      </div>
      {e.notes && <p className="text-xs text-muted-foreground line-clamp-2">{e.notes}</p>}
      <div className="flex gap-1 justify-end mt-1 opacity-0 group-hover:opacity-100">
        <button onClick={onEdit} className="text-xs px-2 py-1 hover:bg-zinc-100 rounded">Editar</button>
        <button onClick={onDelete} className="text-xs px-2 py-1 hover:bg-red-50 text-red-600 rounded">Borrar</button>
      </div>
    </div>
  );
}
