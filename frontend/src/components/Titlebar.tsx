import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconMinus, IconSquare, IconX } from "@tabler/icons-react";

export default function Titlebar({ title }: { title: string }) {
  const win = getCurrentWindow();
  return (
    <div data-tauri-drag-region className="h-8 bg-zinc-900 text-white flex items-center justify-between select-none shrink-0">
      <div data-tauri-drag-region className="flex-1 px-3 text-xs font-medium truncate">{title}</div>
      <div className="flex h-full">
        <button onClick={() => win.minimize()} className="w-11 h-8 grid place-items-center hover:bg-white/10"><IconMinus size={14} /></button>
        <button onClick={() => win.toggleMaximize()} className="w-11 h-8 grid place-items-center hover:bg-white/10"><IconSquare size={12} /></button>
        <button onClick={() => win.close()} className="w-11 h-8 grid place-items-center hover:bg-red-600"><IconX size={14} /></button>
      </div>
    </div>
  );
}
