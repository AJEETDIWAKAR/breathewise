import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, User } from 'lucide-react';
import type { AppNotification, FamilyProfile, PageId } from '../../types/breathewise';

interface HeaderMenusProps {
  familyProfile: FamilyProfile;
  totalMembers: number;
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAllNotificationsRead: () => void;
  onSelectPage: (id: PageId) => void;
}

export function HeaderMenus({
  familyProfile,
  totalMembers,
  notifications,
  unreadCount,
  onMarkAllNotificationsRead,
  onSelectPage,
}: HeaderMenusProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const notifTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notifOpen && !profileOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifOpen && notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const wasProfileOpen = profileOpen;
        const wasNotifOpen = notifOpen;
        setNotifOpen(false);
        setProfileOpen(false);
        if (wasProfileOpen) {
          profileTriggerRef.current?.focus();
        } else if (wasNotifOpen) {
          notifTriggerRef.current?.focus();
        }
        return;
      }

      if (profileOpen && profileMenuRef.current && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const items = Array.from(
          profileMenuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        );
        if (items.length > 0) {
          e.preventDefault();
          const currentIdx = items.findIndex((el) => el === document.activeElement);
          const nextIdx =
            e.key === 'ArrowDown'
              ? (currentIdx + 1) % items.length
              : (currentIdx - 1 + items.length) % items.length;
          items[nextIdx]?.focus();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen, profileOpen]);

  const navigateFromMenu = (id: PageId) => {
    setNotifOpen(false);
    setProfileOpen(false);
    onSelectPage(id);
  };

  return (
    <>
      <div ref={notifRef} className="relative">
        <button
          ref={notifTriggerRef}
          type="button"
          aria-label={`Notifications (${unreadCount} unread)`}
          aria-expanded={notifOpen}
          onClick={() => {
            setNotifOpen((prev) => !prev);
            setProfileOpen(false);
          }}
          className="relative p-2 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer"
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-amber-800 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <section
            aria-label="Notifications panel"
            className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-lg shadow-sm z-40"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllNotificationsRead}
                  className="min-h-6 px-2 py-1 inline-flex items-center rounded text-xs font-medium text-teal-800 hover:bg-teal-50 hover:text-teal-900 cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {notifications.map((notif) => (
                <li key={notif.id} className="p-3.5 hover:bg-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      if (notif.targetPage) navigateFromMenu(notif.targetPage);
                      else setNotifOpen(false);
                    }}
                    className="w-full text-left space-y-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          notif.read ? 'text-slate-700' : 'text-slate-900'
                        }`}
                      >
                        {notif.title}
                      </span>
                      <span className="text-[11px] text-slate-600">{notif.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div ref={profileRef} className="relative">
        <button
          ref={profileTriggerRef}
          type="button"
          aria-label="Household profile menu"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          onClick={() => {
            setProfileOpen((prev) => !prev);
            setNotifOpen(false);
          }}
          className="flex items-center gap-2 px-2 sm:px-2.5 py-1.5 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-sky-100 text-sky-900 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <span className="hidden md:inline text-sm font-medium text-slate-800 max-w-[200px] truncate">
            {familyProfile.householdName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-600 hidden sm:block" aria-hidden="true" />
        </button>

        {profileOpen && (
          <div
            ref={profileMenuRef}
            role="menu"
            aria-label="Profile options"
            className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-lg shadow-sm z-40 py-1.5"
          >
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {familyProfile.householdName}
              </p>
              <p className="text-xs text-slate-600 tabular-nums">
                {totalMembers} members · {familyProfile.lifestyle.dailyCommuteKm} km/day
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => navigateFromMenu('family')}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Edit My Family Profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => navigateFromMenu('settings')}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Data Mode & Settings
            </button>
          </div>
        )}
      </div>
    </>
  );
}
