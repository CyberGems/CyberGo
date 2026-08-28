import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventItem } from "./events";

type Trashed = EventItem & { deletedAt: string };

type State = {
  trashed: Trashed[];
  trash: (e: EventItem)=>void;
  restore: (id:string)=> EventItem | null;
  purge: (id:string)=>void;
  empty: ()=>void;
};

export const useTrash = create<State>()(persist((set,get)=>({
  trashed: [],
  trash: (e)=> set({ trashed: [{...e, deletedAt: new Date().toISOString()}, ...get().trashed]}),
  restore: (id)=> {
    const t=get().trashed.find(x=>x.id===id);
    if(!t) return null;
    set({ trashed: get().trashed.filter(x=>x.id!==id)});
    const { deletedAt, ...ev } = t;
    return ev as EventItem;
  },
  purge: (id)=> set({ trashed: get().trashed.filter(x=>x.id!==id)}),
  empty: ()=> set({ trashed: []}),
}),{name:"cybergo-trash"}));
