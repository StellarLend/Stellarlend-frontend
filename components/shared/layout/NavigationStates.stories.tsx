import type { Meta, StoryObj } from '@storybook/react';
import NavLink from './NavLink';

const meta: Meta = {
  title: 'Design System/Navigation States',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

export const ActiveStates: StoryObj = {
  render: () => (
    <div className="flex flex-col md:flex-row gap-8 p-8 bg-gray-50 dark:bg-neutral-900 rounded-xl">
      {/* Light Theme Sidebar Example */}
      <div className="w-64 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">Light Context (Sidebar)</h3>
        <NavLink href="/active" className="bg-[#15A350]/10 text-[#15A350]">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] opacity-100" />
          Active Link
        </NavLink>
        <NavLink href="/inactive" className="text-gray-600">
          Inactive Link
        </NavLink>
        <NavLink href="/hover" className="text-gray-600 bg-gray-100 text-[#15A350]">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] opacity-50" />
          Hover State
        </NavLink>
      </div>

      {/* Dark Theme SideNav Example */}
      <div className="w-64 flex flex-col gap-4 p-4 bg-black rounded-lg">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Dark Context (SideNav)</h3>
        <div className="relative group flex items-center gap-2 px-4 py-3.5 rounded-lg font-medium transition-all duration-200 bg-[#15A350]/15 text-[#15A350]">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] opacity-100" />
          <span className="ml-2 font-semibold">Active Menu Item</span>
        </div>
        <div className="relative group flex items-center gap-2 px-4 py-3.5 rounded-lg font-medium transition-all duration-200 text-[#AAABAB]">
          <span className="ml-2">Inactive Menu Item</span>
        </div>
        <div className="relative group flex items-center gap-2 px-4 py-3.5 rounded-lg font-medium transition-all duration-200 text-white bg-white/5">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] opacity-50" />
          <span className="ml-2">Hover State</span>
        </div>
      </div>
    </div>
  ),
};