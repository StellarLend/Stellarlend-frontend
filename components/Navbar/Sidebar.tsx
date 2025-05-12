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

      <div className="space-y-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 font-medium ${
                isActive ? 'text-violet-600' : 'text-gray-500 hover:text-[#2600FF]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
