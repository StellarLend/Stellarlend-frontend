import React from 'react';
import Searchbar from '../Searchbar';
import Image from 'next/image';
import { Notification } from '../ui/icons/Notification';
import { Dropdown } from '../ui/icons';

const TopNav = () => {
  return (
    <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center pt-6 gap-y-4">
      <Searchbar />

      <div className="flex items-center gap-4 sm:gap-6">
        <Notification className="cursor-pointer" />
        <Image
          src="/images/profile.jpg"
          alt="profile"
          className="rounded-full"
          width={32}
          height={32}
        />
        <p className="text-[#1C1A1A] font-semibold text-sm sm:text-base">John Doe</p>
        <Dropdown className="cursor-pointer" />
      </div>
    </div>
  );
};

export default TopNav;
