'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Lock,
  Bell,
  ShieldCheck,
} from 'lucide-react';

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

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 w-full md:w-64 flex-shrink-0">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Account Settings</h1>

      <nav className="space-y-2" aria-label="Sidebar navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center gap-3 font-medium rounded-lg px-4 py-3.5 w-full relative transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2
                ${isActive ? 'bg-[#15A350]/10 text-[#15A350]' : 'text-gray-600 hover:bg-gray-100 hover:text-[#15A350]'}
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator */}
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
                aria-hidden="true"
              />
              {item.icon}
              <span className="ml-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
