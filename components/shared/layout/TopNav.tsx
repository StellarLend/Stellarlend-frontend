import React from 'react';
import Image from 'next/image';
import Searchbar from '../common/Searchbar';
import { Notification } from '../ui/icons/Notification';
import { Dropdown } from '../ui/icons';

const TopNav = () => {
  return (
    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between bg-green-600 px-4 py-3 rounded-md gap-4 sm:gap-0">
      {/* Search Bar */}
      <div className="w-full sm:flex-1 max-w-full sm:max-w-md text-white ">
        <Searchbar placeholder="Search for token, asset, wallet address" />
      </div>

      {/* Right Side Controls */}


      <div className="flex flex-wrap sm:flex-nowrap items-center w-full sm:w-auto gap-3">
        {/* Network Selector */}
        <div
  className="flex items-center text-white text-sm"
  style={{
    width: '135px',
    height: '43.78125px',
    gap: '8px',
    paddingTop: '8px',
    paddingRight: '12px',
    paddingBottom: '8px',
    paddingLeft: '12px',
    borderRadius: '33.2px',
    border: '0.33px solid #FFFFFF',
    background: '#FFFFFF1C',
  }}
>
  <Image src="/icons/stellar.png" alt="Stellar" width={16} height={16} />
  <span>Stellar</span>
  <svg
    className="w-3 h-3 text-white"
    width="10"
    height="6"
    viewBox="0 0 10 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z"
      fill="#FFFFFF"
    />
  </svg>
</div>




{/* Wallet Address */}
<div
  className="flex items-center text-white text-sm"
  style={{
    width: '139px',
    height: '43.78125px',
    gap: '8px',
    paddingTop: '8px',
    paddingRight: '12px',
    paddingBottom: '8px',
    paddingLeft: '12px',
    borderRadius: '33.2px',
    border: '0.33px solid #FFFFFF',
    background: '#FFFFFF1C',
  }}
>
  <span>Ga2j6...f5g3</span>
  <svg
    className="w-3 h-3 text-white"
    width="10"
    height="6"
    viewBox="0 0 10 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z"
      fill="#FFFFFF"
    />
  </svg>
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
