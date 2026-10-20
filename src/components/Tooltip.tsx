import { cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, FocusEvent as ReactFocusEvent, MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from 'react';

type Placement = 'top' | 'bottom' | 'left' | 'right';

const VIEWPORT_MARGIN = 8;
const GAP = 8;

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

export default function Tooltip({
  label,
  placement = 'bottom',
  delay = 250,
  children,
}: {
  label: ReactNode;
  placement?: Placement;
  delay?: number;
  children: ReactElement;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; arrow: CSSProperties } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => clearTimer(), []);

  useLayoutEffect(() => {
    if (!anchor || !cardRef.current) {
      setPosition(null);
      return;
    }
    const card = cardRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = anchor.left + anchor.width / 2;
    const centerY = anchor.top + anchor.height / 2;
    let left = 0;
    let top = 0;
    let arrow: CSSProperties = {};

    if (placement === 'top' || placement === 'bottom') {
      left = clamp(centerX - card.width / 2, VIEWPORT_MARGIN, vw - card.width - VIEWPORT_MARGIN);
      top = placement === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - card.height;
      const arrowX = clamp(centerX - left, 12, card.width - 12);
      arrow = placement === 'bottom'
        ? { top: -4, left: arrowX, marginLeft: -4, borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }
        : { bottom: -4, left: arrowX, marginLeft: -4, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' };
    } else {
      top = clamp(centerY - card.height / 2, VIEWPORT_MARGIN, vh - card.height - VIEWPORT_MARGIN);
      left = placement === 'right' ? anchor.right + GAP : anchor.left - GAP - card.width;
      const arrowY = clamp(centerY - top, 12, card.height - 12);
      arrow = placement === 'right'
        ? { left: -4, top: arrowY, marginTop: -4, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }
        : { right: -4, top: arrowY, marginTop: -4, borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)' };
    }
    setPosition({ left, top, arrow });
  }, [anchor, placement]);

  useEffect(() => {
    if (!anchor) return;
    const hide = () => {
      clearTimer();
      setAnchor(null);
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('wheel', hide, true);
    window.addEventListener('blur', hide);
    // A window that was minimized and restored comes back with the tooltip
    // of the control the pointer was on, so it is closed when it comes back.
    window.addEventListener('focus', hide);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('wheel', hide, true);
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', hide);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [anchor]);

  if (!isValidElement(children)) return children;
  const child = children as ReactElement<any>;
  const show = (event: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>) => {
    child.props.onMouseEnter?.(event);
    child.props.onFocus?.(event);
    clearTimer();
    if (!label) return;
    const rect = event.currentTarget.getBoundingClientRect();
    timerRef.current = setTimeout(() => setAnchor(rect), delay);
  };
  const hide = (event: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>) => {
    child.props.onMouseLeave?.(event);
    child.props.onBlur?.(event);
    clearTimer();
    setAnchor(null);
  };
  const clickHide = (event: ReactMouseEvent<HTMLElement>) => {
    child.props.onClick?.(event);
    clearTimer();
    setAnchor(null);
  };
  const cloned = cloneElement(child, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onClick: clickHide,
  });

  return (
    <>
      {cloned}
      {anchor && label && createPortal(
        <div
          className="tooltip-layer"
          style={{
            left: position?.left ?? -9999,
            top: position?.top ?? -9999,
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          <div ref={cardRef} className="tooltip-card">
            {label}
            <span className="tooltip-arrow" style={position?.arrow} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
