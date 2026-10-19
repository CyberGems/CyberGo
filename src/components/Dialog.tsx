import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex^="-"])',
].join(',');

/** Elements that can receive keyboard focus inside a container, in DOM order. */
export function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el.hidden) return false;
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
}

function focusSafely(el: HTMLElement | null) {
  if (!el || !el.isConnected) return;
  try {
    el.focus();
  } catch {
    /* the element cannot take focus, nothing else to do */
  }
}

/**
 * Keeps the keyboard focus inside a container while it is open.
 *
 * On mount the element that had the focus is remembered, and the focus is moved
 * into the container (the element that was already focused inside it wins, so an
 * `autoFocus` field is not stolen). Tab and Shift+Tab cycle through the
 * focusable children, and the background stays unreachable. When the container
 * unmounts the focus goes back to the remembered element.
 */
export function useFocusTrap<T extends HTMLElement>(ref: RefObject<T | null>, enabled = true, focusTarget: 'first' | 'container' = 'first') {
  const restoreRef = useRef<HTMLElement | null>(null);
  const wasEnabled = useRef(false);

  // The opener is captured while rendering, before the browser moves the focus
  // to an `autoFocus` field of the dialog that is about to mount.
  if (enabled && !wasEnabled.current) {
    wasEnabled.current = true;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  useEffect(() => {
    if (!enabled) return;
    const container = ref.current;
    if (!container) return;

    const moveInside = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && container.contains(active)) return;
      if (focusTarget === 'container') {
        focusSafely(container);
        return;
      }
      const items = focusableElements(container);
      if (items.length === 0) {
        focusSafely(container);
        return;
      }
      focusSafely(items[0]);
    };

    const frame = window.requestAnimationFrame(moveInside);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const items = focusableElements(container);
      if (items.length === 0) {
        event.preventDefault();
        focusSafely(container);
        return;
      }
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!active || !container.contains(active)) {
        // Another layer (a menu or a popover) owns the focus, it moves it back
        // on its own. Only a lost focus is pulled into the dialog.
        if (active && active !== document.body) return;
        event.preventDefault();
        focusSafely(items[0]);
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey) {
        if (active === first) {
          event.preventDefault();
          focusSafely(last);
        }
      } else if (active === last) {
        event.preventDefault();
        focusSafely(first);
      }
    };

    // A popover or a menu that belongs to this dialog, such as the date
    // picker or the text context menu, is rendered outside the container and
    // keeps the focus while it is open.
    const belongsToDialog = (target: HTMLElement) => Boolean(
      target.closest('[data-dialog-overlay], [role="menu"], [role="listbox"]'),
    );

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (container.contains(target)) return;
      if (belongsToDialog(target)) return;
      // The focus left the dialog by accident, so it goes back in.
      moveInside();
    };

    // When the focused element disappears, such as a popover that closes, the
    // focus lands on the body and would be lost.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof HTMLElement) return;
      if (document.activeElement && document.activeElement !== document.body) return;
      moveInside();
    };

    // The listener runs on the bubble phase, so a menu that lives outside the
    // dialog can move the focus back before the trap looks at it.
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.cancelAnimationFrame(frame);
      focusSafely(restoreRef.current);
    };
  }, [ref, enabled, focusTarget]);
}

export interface DialogPanelProps {
  children: ReactNode;
  /** Class of the panel that holds the dialog content. */
  className?: string;
  /** Class of the backdrop that holds the panel. */
  backdropClassName?: string;
  /** Accessible name, used when the dialog has no visible heading. */
  label?: string;
  /** Id of the element that names the dialog, usually its heading. */
  labelledBy?: string;
  /** Called when the backdrop (outside the panel) is pressed. */
  onBackdropMouseDown?: () => void;
  /** Keyboard handler of the panel, for dialogs with their own shortcuts. */
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  /**
   * Where the focus lands when the dialog opens: on the first control, or on
   * the panel itself for dialogs driven by the Enter and Escape shortcuts.
   */
  focusTarget?: 'first' | 'container';
}

/**
 * A modal panel with dialog semantics and a trapped focus.
 *
 * The panel is marked as a dialog, it takes the focus when it opens, keeps it
 * while it is open and gives it back to the opener when it closes.
 */
export default function DialogPanel({
  children,
  className,
  backdropClassName,
  label,
  labelledBy,
  onBackdropMouseDown,
  onKeyDown,
  focusTarget,
}: DialogPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, focusTarget);

  return (
    <div className={backdropClassName ? `backdrop ${backdropClassName}` : 'backdrop'} onMouseDown={onBackdropMouseDown}>
      <div
        ref={panelRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
