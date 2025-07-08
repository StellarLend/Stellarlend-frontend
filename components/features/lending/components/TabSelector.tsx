interface TabSelectorProps {
    activeTab: 'lend' | 'borrow';
    onTabChange: (tab: 'lend' | 'borrow') => void;
  }
  
  export default function TabSelector({ activeTab, onTabChange }: TabSelectorProps) {
    return (
      <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
        <button
          onClick={() => onTabChange('lend')}
          className={`flex-1 px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'lend'
              ? 'bg-green-500 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Lend Assets
        </button>
        <button
          onClick={() => onTabChange('borrow')}
          className={`flex-1 px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'borrow'
              ? 'bg-green-500 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Borrow Assets
        </button>
      </div>
    );
  }