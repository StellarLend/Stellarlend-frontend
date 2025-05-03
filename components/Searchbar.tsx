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
            border: '1px solid var(--New-outline, #71B48D)',
          }}
        />
      </div>
    </div>
  );
};

export default Searchbar;
