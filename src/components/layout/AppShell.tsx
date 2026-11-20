import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarClock,
  ChevronDown,
  Home,
  LayoutDashboard,
  Leaf,
  Menu,
  MessageSquare,
  Settings,
  User,
  Users,
  Wind,
  X,
} from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import type { PageId } from '../../types/breathewise';
import { LocationSelector } from '../ui/LocationSelector';

export interface NavItem {
  id: PageId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
  { id: 'air-quality', label: 'Air Quality', shortLabel: 'Air', icon: Activity },
  { id: 'assistant', label: 'AI Assistant', shortLabel: 'Assistant', icon: MessageSquare },
  { id: 'family', label: 'My Family', shortLabel: 'Family', icon: Users },
  { id: 'planner', label: 'Daily Planner', shortLabel: 'Planner', icon: CalendarClock },
  { id: 'indoor', label: 'Indoor Air', shortLabel: 'Indoor', icon: Home },
  { id: 'sustainable', label: 'Sustainable Choices', shortLabel: 'Choices', icon: Leaf },
  { id: 'impact', label: 'Environmental Impact', shortLabel: 'Impact', icon: BarChart3 },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

const MOBILE_BAR_IDS: PageId[] = ['overview', 'air-quality', 'planner', 'assistant'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    activePage,
    setActivePage,
    familyProfile,
    notifications,
    markAllNotificationsRead,
  } = useAppState();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const notifTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!notifOpen && !profileOpen && !mobileMenuOpen) return;

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
        setMobileMenuOpen(false);
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

      if (mobileMenuOpen && e.key === 'Tab' && mobileDrawerRef.current) {
        const focusables = Array.from(
          mobileDrawerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first || !mobileDrawerRef.current.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else if (
            document.activeElement === last ||
            !mobileDrawerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen, profileOpen, mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => mobileCloseBtnRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [mobileMenuOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalMembers =
    familyProfile.members.adults + familyProfile.members.children + familyProfile.members.seniors;
  const currentNav = NAV_ITEMS.find((item) => item.id === activePage) ?? NAV_ITEMS[0];

  const handleSelectPage = (id: PageId) => {
    setActivePage(id);
    setMobileMenuOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f7f9] text-slate-900 flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:bg-white focus:text-teal-900 focus:border focus:border-teal-700 focus:rounded-md focus:text-sm focus:font-semibold focus:shadow"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside
        aria-label="Primary sidebar"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen"
      >
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Wind className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold tracking-tight text-slate-900 leading-none">
                BreatheWise
              </p>
              <p className="text-xs text-slate-600 mt-1 truncate">Breathe better. Live smarter.</p>
            </div>
          </div>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => handleSelectPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-900 border border-teal-200'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-600'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-1">
          <p className="font-medium text-slate-900 truncate">{familyProfile.householdName}</p>
          <p className="tabular-nums">
            {totalMembers} member{totalMembers === 1 ? '' : 's'} · {familyProfile.homeEnvironment.budgetTier} budget
          </p>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <div
            className="fixed inset-0 bg-slate-900/45"
            onClick={() => setMobileMenuOpen(false)}
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
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile full navigation" className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => handleSelectPage(item.id)}
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
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
                className="lg:hidden p-2 -ml-1 text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="text-xs text-slate-600 hidden sm:block">BreatheWise Workspace</p>
                <h1 className="text-[15px] sm:text-lg font-semibold text-slate-900 truncate">
                  {currentNav.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Searchable AirLive Location Selector */}
              <LocationSelector />

              {/* Notification Area */}
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
                  <div
                    role="region"
                    aria-label="Notifications panel"
                    className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-lg shadow-sm z-40"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                      <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="text-xs font-medium text-teal-800 hover:text-teal-900 cursor-pointer"
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
                              if (notif.targetPage) handleSelectPage(notif.targetPage);
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
                  </div>
                )}
              </div>

              {/* User Profile Area */}
              <div ref={profileRef} className="relative">
                <button
                  ref={profileTriggerRef}
                  type="button"
                  aria-label="Household profile menu"
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
                      onClick={() => handleSelectPage('family')}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Edit My Family Profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectPage('settings')}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Data Mode & Settings
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 sm:px-6 py-6 focus:outline-none">
          <div className="max-w-6xl mx-auto space-y-6">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (compact <= 60px, < 15% of 844px mobile viewport) */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid grid-cols-5 h-14"
      >
        {MOBILE_BAR_IDS.map((id) => {
          const item = NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => handleSelectPage(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                active ? 'text-teal-700' : 'text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="More pages"
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-600 cursor-pointer"
        >
          <Menu className="w-4 h-4" aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
