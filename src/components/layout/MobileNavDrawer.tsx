import { useCallback, useRef, type ComponentType } from 'react';
import { Wind, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { PageId } from '../../types/breathewise';

export interface NavItem {
  id: PageId;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
}

interface MobileNavDrawerProps {
  open: boolean;
  activePage: PageId;
  navItems: NavItem[];
  onClose: () => void;
  onSelectPage: (id: PageId) => void;
}

export function MobileNavDrawer({
  open,
  activePage,
  navItems,
  onClose,
  onSelectPage,
}: MobileNavDrawerProps) {
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleEscape = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap({
    active: open,
    containerRef: mobileDrawerRef,
    initialFocusRef: mobileCloseBtnRef,
    onEscape: handleEscape,
    restoreFocus: true,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden flex"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation menu"
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-slate-900/45"
        onClick={onClose}
      />
      <div
        ref={mobileDrawerRef}
        className="relative z-10 w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-teal-700 text-white flex items-center justify-center">
              <Wind className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="font-bold text-slate-900">BreatheWise</span>
          </div>
          <button
            ref={mobileCloseBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Mobile full navigation" className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelectPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left cursor-pointer ${
                  active
                    ? 'bg-teal-50 text-teal-900 border border-teal-200'
                    : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
