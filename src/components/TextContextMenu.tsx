import { useEffect, useState } from 'react';
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
  'date',
  'datetime-local',
  'file',
  'hidden',
  'month',
  'radio',
  'range',
  'reset',
  'submit',
  'time',
  'week',
]);

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
    menu.target.select();
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

export default function TextContextMenu({ copy }: { copy: Copy }) {
  const [menu, setMenu] = useState<MenuState | null>(null);

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

  if (!menu) return null;

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
      current.target.select();
      return;
    }
    if (action === 'copy') {
      if (!document.execCommand('copy') && navigator.clipboard) {
        await navigator.clipboard.writeText(current.target.value.slice(current.start, current.end));
      }
      return;
    }
    if (action === 'delete') {
      replaceSelection(current.target, current.start, current.end, '');
      return;
    }
    try {
      const value = await navigator.clipboard.readText();
      replaceSelection(current.target, current.start, current.end, value);
    } catch {
      document.execCommand('paste');
    }
  }

  return (
    <div
      className="text-context-menu"
      role="menu"
      aria-label={copy.contextMenu}
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {actions.map(({ id, label, icon: Icon, disabled }) => (
        <button
          type="button"
          className="text-context-menu-item"
          role="menuitem"
          key={id}
          disabled={disabled}
          onClick={() => void run(id)}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
