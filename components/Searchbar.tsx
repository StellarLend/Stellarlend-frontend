<<<<<<< HEAD
import { Search } from 'lucide-react';
import React from 'react';

const Searchbar = () => {
  return (
    <div className="w-full max-w-md">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8F8989]" size={20} />
        <input
          type="text"
          placeholder="Search..."
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#8F8989] font-semibold text-sm sm:text-base focus:outline-none focus:ring-1 hover:border-[#2600FF] focus:ring-[#2600FF] focus:border-transparent"
=======
import React from 'react';

type SearchbarProps = {
  placeholder?: string;
};

const Searchbar: React.FC<SearchbarProps> = ({ placeholder = "Search..." }) => {
  return (
    <div className="w-full max-w-md">
      <div className="w-full">
        <input
          type="text"
          placeholder={placeholder}
          className="w-full px-4 py-2 rounded-xl font-semibold text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-[var(--New-outline,#71B48D)] focus:border-transparent hover:border-[var(--New-outline,#71B48D)]"
          style={{
            border: '1px solid var(--New-outline,rgb(83, 204, 133))',
          }}
>>>>>>> e9ea5f44481976f321dfb27038b130f98338d221
        />
      </div>
    </div>
  );
};

export default Searchbar;
