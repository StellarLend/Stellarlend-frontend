import React from 'react';
import Image from 'next/image';
import Searchbar from '../Searchbar';
import { Notification } from '../ui/icons/Notification';
import { Dropdown } from '../ui/icons';

const TopNav = () => {
  return (
    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between bg-green-600 px-4 py-3 rounded-md gap-4 sm:gap-0">
      {/* Search Bar */}
      <div className="w-full sm:flex-1 max-w-full sm:max-w-md">
        <Searchbar placeholder="Search for token, asset, wallet address" />
      </div>

      {/* Right Side Controls */}
      <div className="flex flex-wrap sm:flex-nowrap items-center w-full sm:w-auto gap-3">
        {/* Network Selector */}
        <div className="flex items-center gap-2 bg-green-700 px-3 py-1.5 rounded-full text-white text-sm">
          <Image src="/icons/stellar.png" alt="Stellar" width={16} height={16} />
          <span>Stellar</span>
          <Dropdown className="w-3 h-3" />
        </div>
{/* Wallet Address */}
<div className="flex items-center gap-1 bg-green-700 px-3 py-1.5 rounded-full text-white text-sm">
  <span>Ga2j6...f5g3</span>
  <Dropdown className="w-3 h-3" />
</div>

{/* Divider */}
<div
  className="h-8 border-l"
  style={{
    borderWidth: '1px',
    borderColor: '#71B48D',
  }}
></div>

{/* Notification Icon */}
<div className=" p-2 rounded cursor-pointer">
  <Image
    src="/icons/notification.png"
    alt="Notifications"
    width={24}
    height={24}
  />
</div>

        {/* Profile Avatar */}
        <Image
          src="/images/profile.jpg"
          alt="profile"
          className="rounded-full cursor-pointer"
          width={32}
          height={32}
        />
      </div>
    </div>
  );
};

export default TopNav;
