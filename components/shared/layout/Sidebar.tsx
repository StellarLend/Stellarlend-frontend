"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  User,
  Lock,
  Bell,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
} from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';

const navItems = [
  {
    label: 'Profile Settings',
    href: '/account/profile',
    icon: <User size={18} />,
  },
  {
    label: 'Password',
    href: '/account/password',
    icon: <Lock size={18} />,
  },
  {
    label: 'Notification',
    href: '/account/notification',
    icon: <Bell size={18} />,
  },
  {
    label: 'Verification',
    href: '/account/verification',
    icon: <ShieldCheck size={18} />,
  },
];

const Sidebar = () => {
  const pathname = usePathname();
  const { isSidebarOpen, isMobile, toggleSidebar, closeSidebar } = useSidebar();
  const [isMounted, setIsMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const isCollapsed = !isSidebarOpen && !isMobile;
  const sidebarWidth = isCollapsed ? 'w-20' : 'w-full md:w-64';
  const toggleLabel = isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar';

  useEffect(() => {
    setIsMounted(true);

    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMounted || !isMobile || !isSidebarOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMounted, isMobile, isSidebarOpen]);

  useEffect(() => {
    if (!isMounted || !isMobile || !isSidebarOpen || !drawerRef.current) {
      return;
    }

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
    ).filter((element) => !element.hasAttribute('disabled'));

    const firstElement = focusableElements[0] || drawerRef.current;
    const lastElement = focusableElements[focusableElements.length - 1] || drawerRef.current;

    firstElement?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
        return;
      }

      if (event.key !== 'Tab' || !firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, isMobile, isSidebarOpen, closeSidebar]);

  if (isMobile) {
    return (
      <>
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Account navigation</p>
            <p className="text-xs text-slate-500">Tap to open settings navigation.</p>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={isSidebarOpen}
            aria-label={isSidebarOpen ? 'Close account navigation' : 'Open account navigation'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#15A350]"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {isSidebarOpen ? (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                onClick={closeSidebar}
                aria-hidden="true"
                data-testid="sidebar-overlay"
              />
              <motion.aside
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Account navigation drawer"
                tabIndex={-1}
                className="fixed left-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto bg-white shadow-2xl"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeInOut' }}
              >
                <div className="flex min-h-full flex-col">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Account Settings</h2>
                      <p className="text-sm text-slate-500">Manage your profile, security, and notifications.</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeSidebar}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#15A350]"
                      aria-label="Close account navigation drawer"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 p-4">
                    <nav className="space-y-2" aria-label="Account navigation">
                      {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`group flex items-center gap-3 w-full rounded-2xl px-4 py-3 transition-all duration-200 ${
                              isActive
                                ? 'bg-[#15A350]/10 text-[#15A350]'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-[#15A350]'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                            aria-label={item.label}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                </div>
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-300 ${sidebarWidth}`}>
      <div className={`${isCollapsed ? 'p-3' : 'p-4 md:p-6'} space-y-6`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? '' : ''}`}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#15A350] text-white font-semibold">
              A
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-gray-800">Account Settings</h1>
                <p className="text-sm text-gray-500">Manage your profile, security, and notification settings.</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#15A350]"
            aria-label={toggleLabel}
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="space-y-2" aria-label="Sidebar navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 w-full rounded-lg transition-all duration-200 ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3.5'
                } ${
                  isActive
                    ? 'bg-[#15A350]/10 text-[#15A350]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#15A350]'
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
              >
                {item.icon}
                <span className={isCollapsed ? 'sr-only' : 'ml-1'}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
