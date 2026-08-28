import { create } from "zustand";
import { persist } from "zustand/middleware";

async function sha(text:string){
  const buf=await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

type State = {
  hash: string | null;
  locked: boolean;
  setPassword: (pw:string)=>Promise<void>;
  unlock: (pw:string)=>Promise<boolean>;
  lock: ()=>void;
  removePassword: ()=>void;
};

export const useAuth = create<State>()(persist((set,get)=>({
  hash: null,
  locked: false,
  setPassword: async (pw)=>{
    const h=await sha(pw);
    set({hash:h, locked:true});
  },
  unlock: async (pw)=>{
    const h=await sha(pw);
    if(h===get().hash){ set({locked:false}); return true; }
    return false;
  },
  lock: ()=> { if(get().hash) set({locked:true}); },
  removePassword: ()=> set({hash:null, locked:false}),
}),{name:"cybergo-auth"}));
