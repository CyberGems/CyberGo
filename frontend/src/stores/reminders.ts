import { create } from "zustand";

export type Reminder = {
  id: string;
  subject: string;
  dueAt: string;
  snoozedUntil?: string | null;
};

function formatOverdue(dueAt: string, t: (k:string,o?:any)=>string) {
  const diff = Date.now() - new Date(dueAt).getTime();
  const mins = Math.floor(diff/60000);
  if (mins < 60) return t("overdue",{time:`${mins} minute(s)`});
  const hours = Math.floor(mins/60);
  if (hours < 48) return t("overdue",{time:`${hours} hour(s)`});
  const days = Math.floor(hours/24);
  const months = Math.floor(days/30);
  if (months < 1) return t("overdue",{time:`${days} day(s)`});
  const years = Math.floor(months/12);
  if (years < 1) return t("overdue",{time:`${months} month(s) ${days%30} day(s)`});
  return t("overdue",{time:`${years} year(s) ${months%12} month(s) ${days%30} day(s)`});
}

type State = {
  items: Reminder[];
  sounding: boolean;
  alwaysOnTop: boolean;
  setItems: (v: Reminder[])=>void;
  dismiss: (id:string)=>void;
  dismissAll: ()=>void;
  snooze: (mins:number)=>void;
  setAlwaysOnTop: (v:boolean)=>void;
  setSounding: (v:boolean)=>void;
  overdueText: (r:Reminder, t:any)=>string;
};

export const useReminders = create<State>((set,get)=>({
  items: [],
  sounding: false,
  alwaysOnTop: true,
  setItems: (items)=> set({items}),
  dismiss: (id)=> set({items:get().items.filter(i=>i.id!==id)}),
  dismissAll: ()=> set({items:[], sounding:false}),
  snooze: (mins)=> {
    const until = new Date(Date.now()+mins*60000).toISOString();
    set({items:get().items.map(i=>({...i, snoozedUntil:until})), sounding:false});
  },
  setAlwaysOnTop: (v)=> set({alwaysOnTop:v}),
  setSounding: (v)=> set({sounding:v}),
  overdueText: (r,t)=> formatOverdue(r.dueAt,t),
}));
