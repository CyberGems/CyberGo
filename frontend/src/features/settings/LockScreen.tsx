import { useState } from "react";
import { useAuth } from "@/stores/auth";
import { IconLock } from "@tabler/icons-react";

export default function LockScreen(){
  const { hash, locked, unlock, setPassword, removePassword } = useAuth();
  const [pw,setPw]=useState("");
  const [newPw,setNewPw]=useState("");
  const [err,setErr]=useState("");
  if(!hash || !locked) return null;
  const tryUnlock=async()=>{
    const ok=await unlock(pw);
    if(!ok) setErr("Contraseña incorrecta");
    else setErr("");
  };
  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur z-[100] grid place-items-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-[360px] space-y-4 text-center">
        <IconLock size={32} className="mx-auto text-zinc-700" />
        <h3 className="font-semibold">CyberGo bloqueado</h3>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter" && tryUnlock()} placeholder="Contraseña" className="w-full border rounded-lg px-3 py-2 text-sm" autoFocus />
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button onClick={tryUnlock} className="w-full bg-zinc-900 text-white rounded-lg py-2 text-sm">Desbloquear</button>
        <button onClick={()=>removePassword()} className="text-xs text-muted-foreground underline">Quitar contraseña (dev)</button>
      </div>
    </div>
  );
}
export function PasswordSetup(){
  const { hash, setPassword, removePassword, lock } = useAuth();
  const [pw,setPw]=useState("");
  if(hash) return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">Protegido</span>
      <button onClick={()=>lock()} className="px-3 py-1.5 border rounded-lg bg-white hover:bg-zinc-50">Bloquear</button>
      <button onClick={()=>removePassword()} className="px-3 py-1.5 border rounded-lg bg-white hover:bg-zinc-50">Quitar</button>
    </div>
  );
  return (
    <div className="flex gap-2">
      <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Nueva contraseña" className="border rounded-lg px-3 py-1.5 text-xs w-40" />
      <button onClick={async()=>{ if(pw.length>=4){ await setPassword(pw); setPw(""); } }} className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs">Proteger</button>
    </div>
  );
}
