import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ClipboardPaste, Copy as CopyIcon, ListChecks, Redo2, Trash2, Undo2 } from 'lucide-react';
import type { Copy } from '../i18n';

type EditableTarget = HTMLInputElement | HTMLTextAreaElement;
type ActionId = 'undo' | 'redo' | 'copy' | 'paste' | 'select-all' | 'delete';

interface MenuState {
  x: number;
  y: number;
  target: EditableTarget;
  start: number;
  end: number;
  canUndo: boolean;
  canRedo: boolean;
}

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Inputs that hold a date or a time: their text can be selected and replaced. */
const DATE_INPUT_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);

const DATE_VALUE_PATTERNS: Record<string, RegExp> = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  'datetime-local': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
  time: /^\d{2}:\d{2}(:\d{2})?$/,
  month: /^\d{4}-\d{2}$/,
  week: /^\d{4}-W\d{2}$/,
};

function editableTarget(node: EventTarget | null): EditableTarget | null {
  if (node instanceof HTMLTextAreaElement) {
    return node.disabled || node.readOnly ? null : node;
  }
  if (!(node instanceof HTMLInputElement) || node.disabled || node.readOnly) return null;
  return NON_TEXT_INPUT_TYPES.has(node.type) ? null : node;
}

function selectionOf(target: EditableTarget) {
  const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0;
  const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : target.value.length;
  return { start, end };
}

function commandEnabled(command: 'undo' | 'redo') {
  try {
    return document.queryCommandEnabled(command);
  } catch {
    return false;
  }
}

function restoreSelection(menu: MenuState) {
  menu.target.focus();
  try {
    menu.target.setSelectionRange(menu.start, menu.end);
  } catch {
    // Date and time inputs do not support a selection range.
    try {
      menu.target.select();
    } catch {
      /* the input has no selectable text */
    }
  }
}

function replaceSelection(target: EditableTarget, start: number, end: number, value: string) {
  try {
    target.setRangeText(value, start, end, 'end');
  } catch {
    document.execCommand('insertText', false, value);
  }
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Writes a value into an input that does not support `setRangeText`. */
function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (!setter) return false;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/** Puts the clipboard text in the field, falling back to a plain text selection. */
function applyText(target: EditableTarget, start: number, end: number, text: string) {
  if (target instanceof HTMLInputElement && DATE_INPUT_TYPES.has(target.type)) {
    const pattern = DATE_VALUE_PATTERNS[target.type];
    const value = text.trim();
    if (pattern && pattern.test(value)) return setNativeValue(target, value);
    return false;
  }
  replaceSelection(target, start, end, text);
  return true;
}

/** Reads the clipboard through the main process, with the browser as a fallback. */
async function readClipboardText(): Promise<string | null> {
  const api = window.cyberGoAPI;
  if (api && typeof api.readClipboardText === 'function') {
    try {
      return await api.readClipboardText();
    } catch (err) {
      console.error('CyberGo could not read the clipboard', err);
      return null;
    }
  }
  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    console.error('CyberGo could not read the clipboard', err);
    return null;
  }
}

export default function TextContextMenu({ copy }: { copy: Copy }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    function onContextMenu(event: MouseEvent) {
      const target = editableTarget(event.target);
      if (!target) {
        setMenu(null);
        return;
      }
      event.preventDefault();
      target.focus();
      const { start, end } = selectionOf(target);
      const width = 220;
      const height = 246;
      itemRefs.current = [];
      setMenu({
        x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
        y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
        target,
        start,
        end,
        canUndo: commandEnabled('undo'),
        canRedo: commandEnabled('redo'),
      });
    }

    function close() {
      setMenu(null);
    }

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mousedown', close);
      window.removeEventListener('blur', close);
    };
  }, []);

  // The menu takes the focus as soon as it opens.
  useEffect(() => {
    if (!menu) return;
    const first = itemRefs.current.find((node) => node && !node.disabled);
    first?.focus();
  }, [menu]);

  if (!menu) {
    return notice ? <div className="text-context-toast" role="alert">{notice}</div> : null;
  }

  const hasSelection = menu.end > menu.start;
  const actions: {
    id: ActionId;
    label: string;
    icon: typeof Undo2;
    disabled: boolean;
  }[] = [
    { id: 'undo', label: copy.contextUndo, icon: Undo2, disabled: !menu.canUndo },
    { id: 'redo', label: copy.contextRedo, icon: Redo2, disabled: !menu.canRedo },
    { id: 'copy', label: copy.contextCopy, icon: CopyIcon, disabled: !hasSelection },
    { id: 'paste', label: copy.contextPaste, icon: ClipboardPaste, disabled: false },
    { id: 'select-all', label: copy.contextSelectAll, icon: ListChecks, disabled: menu.target.value.length === 0 },
    { id: 'delete', label: copy.contextDelete, icon: Trash2, disabled: !hasSelection },
  ];

  function closeMenu(restoreFocus: boolean) {
    const current = menu;
    setMenu(null);
    if (restoreFocus && current) restoreSelection(current);
  }

  function enabledItems() {
    return itemRefs.current.filter((node): node is HTMLButtonElement => !!node && !node.disabled);
  }

  function moveFocus(step: number) {
    const items = enabledItems();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = current === -1
      ? (step > 0 ? 0 : items.length - 1)
      : (current + step + items.length) % items.length;
    items[next].focus();
  }

  function focusEdge(edge: 'first' | 'last') {
    const items = enabledItems();
    if (items.length === 0) return;
    (edge === 'first' ? items[0] : items[items.length - 1]).focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusEdge('first');
    } else if (event.key === 'End') {
      event.preventDefault();
      focusEdge('last');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      // The menu gets out of the way and the focus keeps moving forward.
      closeMenu(true);
    }
  }

  async function run(action: ActionId) {
    const current = menu;
    if (!current) return;
    setMenu(null);
    restoreSelection(current);

    if (action === 'undo' || action === 'redo') {
      document.execCommand(action);
      return;
    }
    if (action === 'select-all') {
      try {
        current.target.select();
      } catch {
        /* the input has no selectable text */
      }
      return;
    }
    if (action === 'copy') {
      if (!document.execCommand('copy') && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(current.target.value.slice(current.start, current.end));
        } catch (err) {
          console.error('CyberGo could not copy the selection', err);
          setNotice(copy.copyFailed);
        }
      }
      return;
    }
    if (action === 'delete') {
      if (current.target instanceof HTMLInputElement && DATE_INPUT_TYPES.has(current.target.type)) {
        setNativeValue(current.target, '');
        return;
      }
      replaceSelection(current.target, current.start, current.end, '');
      return;
    }
    const value = await readClipboardText();
    if (value == null) {
      setNotice(copy.pasteFailed);
      return;
    }
    if (!applyText(current.target, current.start, current.end, value)) {
      setNotice(copy.pasteFailed);
    }
  }

  return (
    <>
      <div
        className="text-context-menu"
        role="menu"
        aria-label={copy.menuLabel}
        style={{ left: menu.x, top: menu.y }}
        onContextMenu={(event) => event.preventDefault()}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {actions.map(({ id, label, icon: Icon, disabled }, index) => (
          <button
            type="button"
            className="text-context-menu-item"
            role="menuitem"
            key={id}
            disabled={disabled}
            ref={(node) => { itemRefs.current[index] = node; }}
            onClick={() => void run(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {notice && <div className="text-context-toast" role="alert">{notice}</div>}
    </>
  );
}
