import { useEffect, useRef, type RefObject } from 'react';

const DEFAULT_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  shouldRestoreFocus?: () => boolean;
}

export function useFocusTrap({
  active,
  containerRef,
  onEscape,
  initialFocusRef,
  restoreFocus = true,
  shouldRestoreFocus,
}: UseFocusTrapOptions): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  const shouldRestoreRef = useRef(shouldRestoreFocus);

  useEffect(() => {
    onEscapeRef.current = onEscape;
    shouldRestoreRef.current = shouldRestoreFocus;
  });

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const container = containerRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(DEFAULT_FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(DEFAULT_FOCUSABLE_SELECTOR),
        ).filter((el) => {
          if (el.hasAttribute('hidden') || el.closest('[hidden]')) return false;
          const style =
            typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : null;
          if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
          return true;
        });
        if (focusables.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      const allowRestore =
        restoreFocus && (shouldRestoreRef.current ? shouldRestoreRef.current() : true);
      if (
        allowRestore &&
        previousFocusRef.current &&
        document.body.contains(previousFocusRef.current)
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, containerRef, initialFocusRef, restoreFocus]);
}
