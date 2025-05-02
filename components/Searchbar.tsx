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
        />
      </div>
    </div>
  );
};

export default Searchbar;
