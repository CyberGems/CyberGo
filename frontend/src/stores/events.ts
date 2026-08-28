import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Importance = "low"|"medium"|"high"|"critical";
export type Recurrence = { kind:"none"|"daily"|"weekly"|"monthly"|"yearly"|"custom"; interval?:number; customRule?:string };
export type Alarm = { enabled:boolean; beforeMinutes:number; sound?:string };

export type EventItem = {
  id: string;
  subject: string;
  dueAt: string;
  notes?: string;
  importance: Importance;
  recurrence: Recurrence;
  alarm: Alarm;
  attachments: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

const now = ()=> new Date().toISOString();
const mk = (id:string, subject:string, daysOffset:number, importance:Importance="medium"):EventItem=>({
  id, subject, dueAt: new Date(Date.now()+daysOffset*86400000).toISOString(),
  importance, recurrence:{kind:"none"}, alarm:{enabled:true, beforeMinutes:15},
  attachments:[], tags:[], notes:"", createdAt: now(), updatedAt: now()
});

type State = {
  events: EventItem[];
  query: string;
  add: (e: EventItem)=>void;
  update: (id:string, patch: Partial<EventItem>)=>void;
  remove: (id:string)=>void;
  setQuery: (q:string)=>void;
};

export const useEvents = create<State>()(persist((set,get)=>({
  events: [
    mk("1","CIBERCR",-760,"critical"),
    mk("2","CHORY",-460,"high"),
    mk("3","monedas 500",-85,"medium"),
    mk("4","RESPALDO DISTRI",-65,"high"),
    mk("5","RESPALDOS",-32,"medium"),
    mk("6","TOMAR SOL",-6,"low"),
  ],
  query: "",
  add: (e)=> set({events:[e,...get().events]}),
  update: (id,p)=> set({events:get().events.map(x=>x.id===id?{...x,...p, updatedAt: now()}:x)}),
  remove: (id)=> set({events:get().events.filter(x=>x.id!==id)}),
  setQuery: (query)=> set({query}),
}),{name:"cybergo-events-v2"}));
