import React from 'react';
import dynamic from 'next/dynamic';
import { IconButton } from '@/components/atoms/IconButton/IconButton';
import { IconPlaceholder } from '@/components/shared/ui/icons/IconPlaceholder';
import useNotificationStream from '@/hooks/useNotificationStream';

// Lazy load Notification icon to reduce initial bundle size
const NotificationIcon = dynamic(() => import('@/components/shared/ui/icons/Notification').then(mod => ({ default: mod.Notification })), {
  loading: () => <IconPlaceholder />,
  ssr: true,
});

/**
 * NotificationBell component that displays a bell icon with an unread count badge.
 * It listens to the SSE stream via useNotificationStream.
 */
const NotificationBell = () => {
  const { unreadCount } = useNotificationStream();

  const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString();
  const showBadge = unreadCount > 0;

  return (
    <IconButton
      aria-label={showBadge ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'No unread notifications'}
    >
      <NotificationIcon className="text-white" width={24} height={24} />
      {showBadge && (
        <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-red-600 text-xs text-white rounded-full flex items-center justify-center font-medium"
        >{displayCount}</span>
      )}
    </IconButton>
  );
};

export default NotificationBell;
