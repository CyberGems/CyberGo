import { useTrash } from "@/stores/trash";
import { useEvents } from "@/stores/events";
import { IconTrash, IconRestore, IconTrashX } from "@tabler/icons-react";

export default function TrashDrawer({ open, onClose }: { open:boolean; onClose:()=>void }){
  const { trashed, restore, purge, empty } = useTrash();
  const add = useEvents(s=>s.add);
  if(!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="w-[420px] max-w-[90vw] bg-white dark:bg-zinc-900 h-full flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2"><IconTrash size={16}/> Papelera ({trashed.length})</h3>
          <button onClick={onClose} className="text-sm px-2 py-1 hover:bg-zinc-100 rounded">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {trashed.length===0 && <p className="text-sm text-muted-foreground text-center py-12">Papelera vacía</p>}
          {trashed.map(e=>(
            <div key={e.id} className="border rounded-lg p-3 flex justify-between items-center">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{e.subject}</div>
                <div className="text-xs text-muted-foreground">{new Date(e.deletedAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={()=>{ const ev=restore(e.id); if(ev) add(ev);}} className="p-2 hover:bg-zinc-100 rounded" title="Restaurar"><IconRestore size={14}/></button>
                <button onClick={()=>purge(e.id)} className="p-2 hover:bg-red-50 text-red-600 rounded" title="Eliminar definitivo"><IconTrashX size={14}/></button>
              </div>
            </div>
          ))}
        </div>
        {trashed.length>0 && <div className="p-3 border-t"><button onClick={empty} className="w-full py-2 text-sm border rounded-lg hover:bg-zinc-50">Vaciar papelera</button></div>}
      </div>
    </div>
  );
}
