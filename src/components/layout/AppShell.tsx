import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  CalendarClock,
  Home,
  LayoutDashboard,
  Leaf,
  Menu,
  MessageSquare,
  Settings,
  Users,
  Wind,
} from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import type { PageId } from '../../types/breathewise';
import { LocationSelector } from '../ui/LocationSelector';
import { HeaderMenus } from './HeaderMenus';
import { MobileNavDrawer, type NavItem } from './MobileNavDrawer';

export type { NavItem };

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

export function AppShell({ children }: { children: ReactNode }) {
  const {
    activePage,
    setActivePage,
    familyProfile,
    notifications,
    markAllNotificationsRead,
  } = useAppState();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalMembers =
    familyProfile.members.adults + familyProfile.members.children + familyProfile.members.seniors;
  const currentNav = NAV_ITEMS.find((item) => item.id === activePage) ?? NAV_ITEMS[0];

  useEffect(() => {
    document.title = `${currentNav.label} – BreatheWise`;
  }, [currentNav.label]);

  const handleSelectPage = (id: PageId) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f7f9] text-slate-900 flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:bg-white focus:text-teal-900 focus:border focus:border-teal-700 focus:rounded-md focus:text-sm focus:font-semibold focus:shadow"
      >
        Skip to main content
      </a>

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

      <MobileNavDrawer
        open={mobileMenuOpen}
        activePage={activePage}
        navItems={NAV_ITEMS}
        onClose={() => setMobileMenuOpen(false)}
        onSelectPage={handleSelectPage}
      />

      <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
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
              <LocationSelector />
              <HeaderMenus
                familyProfile={familyProfile}
                totalMembers={totalMembers}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAllNotificationsRead={markAllNotificationsRead}
                onSelectPage={handleSelectPage}
              />
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 px-4 sm:px-6 py-6 focus:outline-none">
          <p className="sr-only" aria-live="polite">
            {currentNav.label} view active
          </p>
          <div className="max-w-6xl mx-auto space-y-6">{children}</div>
        </main>
      </div>

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
