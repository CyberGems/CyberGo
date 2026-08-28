import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EventItem = { id: string; subject: string; dueAt: string; notes?: string };

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
    { id:"1", subject:"CIBERCR", dueAt: new Date(Date.now()- 760*24*60*60000).toISOString() },
    { id:"2", subject:"CHORY", dueAt: new Date(Date.now()- 460*24*60*60000).toISOString() },
    { id:"3", subject:"monedas 500", dueAt: new Date(Date.now()- 85*24*60*60000).toISOString() },
    { id:"4", subject:"RESPALDO DISTRI", dueAt: new Date(Date.now()- 65*24*60*60000).toISOString() },
    { id:"5", subject:"RESPALDOS", dueAt: new Date(Date.now()- 32*24*60*60000).toISOString() },
    { id:"6", subject:"TOMAR SOL", dueAt: new Date(Date.now()- 6*24*60*60000).toISOString() },
  ],
  query: "",
  add: (e)=> set({events:[e,...get().events]}),
  update: (id,p)=> set({events:get().events.map(x=>x.id===id?{...x,...p}:x)}),
  remove: (id)=> set({events:get().events.filter(x=>x.id!==id)}),
  setQuery: (query)=> set({query}),
}),{name:"cybergo-events"}));
