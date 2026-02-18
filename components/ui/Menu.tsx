import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './cn';

type Item =
  | { type?: 'item'; label: string; onSelect: () => void; disabled?: boolean }
  | { type: 'sep' }
  | { type: 'title'; label: string };

type DetailsMenuProps = {
  detailsRef?: React.RefObject<HTMLDetailsElement | null>;
  className?: string;
  trigger: React.ReactNode;
  triggerProps?: React.ComponentPropsWithoutRef<'summary'>;
  menuId: string;
  menuTestId?: string;
  menuClassName?: string;
  children: React.ReactNode;
  closeOnOutsidePointerDown?: boolean;
  closeOnEscape?: boolean;
};

// Shared <details> menu primitive for TopBar/File/View/Zoom and similar popovers.
// Centralizes outside-click + Escape dismissal so we don't re-implement it per menu.
export function DetailsMenu({
  detailsRef,
  className,
  trigger,
  triggerProps,
  menuId,
  menuTestId,
  menuClassName,
  children,
  closeOnOutsidePointerDown = true,
  closeOnEscape = true
}: DetailsMenuProps) {
  const internalRef = useRef<HTMLDetailsElement | null>(null);
  const mergedRef = detailsRef ?? internalRef;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = mergedRef.current;
    if (!el) return;
    setOpen(el.open);
  }, [mergedRef]);

  useEffect(() => {
    const el = mergedRef.current;
    if (!el) return;

    const onWindowPointerDownCapture = (event: PointerEvent) => {
      if (!closeOnOutsidePointerDown) return;
      if (!el.open) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!el.contains(target)) {
        el.open = false;
        setOpen(false);
      }
    };

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (!closeOnEscape) return;
      if (event.key !== 'Escape') return;
      if (!el.open) return;
      // Keep Escape scoped to the menu first; don't let it clear selection.
      event.preventDefault();
      el.open = false;
      setOpen(false);
    };

    window.addEventListener('pointerdown', onWindowPointerDownCapture, true);
    window.addEventListener('keydown', onWindowKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onWindowPointerDownCapture, true);
      window.removeEventListener('keydown', onWindowKeyDown);
    };
  }, [closeOnEscape, closeOnOutsidePointerDown, mergedRef]);

  return (
    <details
      ref={(node) => {
        internalRef.current = node;
        // Preserve external ref support for callers who already rely on it.
        if (detailsRef) {
          (detailsRef as unknown as { current: HTMLDetailsElement | null }).current = node;
        }
      }}
      className={cn('relative', className)}
      onToggle={(event) => {
        const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(nextOpen);
      }}
    >
      <summary
        {...triggerProps}
        className={cn('list-none cursor-pointer', triggerProps?.className)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        {trigger}
      </summary>
      <div
        id={menuId}
        role="menu"
        data-testid={menuTestId ?? menuId}
        className={cn(menuClassName)}
        data-canvas-interactive="true"
        onPointerDownCapture={(event) => event.stopPropagation()}
        onMouseDownCapture={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </details>
  );
}

export function Menu(props: {
  trigger: React.ReactNode;
  items: Item[];
  align?: 'left' | 'right';
  className?: string;
}) {
  const { trigger, items, align = 'right', className } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const positionClass = align === 'right' ? 'right-0' : 'left-0';

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const rendered = useMemo(
    () =>
      items.map((it, idx) => {
        if (it.type === 'sep')
          return <div key={idx} className="my-1 h-px bg-slate-200 dark:bg-slate-700" />;
        if (it.type === 'title')
          return (
            <div key={idx} className="px-2 py-1 text-[11px] font-semibold text-slate-500">
              {it.label}
            </div>
          );
        return (
          <button
            key={idx}
            className={cn(
              'w-full rounded-md px-2 py-1.5 text-left text-sm transition',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              it.disabled ? 'opacity-50 pointer-events-none' : ''
            )}
            onClick={() => {
              it.onSelect();
              setOpen(false);
            }}
          >
            {it.label}
          </button>
        );
      }),
    [items]
  );

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <span
        onClick={() => setOpen((v) => !v)}
        className="inline-flex"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v);
        }}
      >
        {trigger}
      </span>

      {open ? (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[240px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg',
            'dark:border-slate-800 dark:bg-slate-900',
            positionClass
          )}
        >
          {rendered}
        </div>
      ) : null}
    </div>
  );
}
