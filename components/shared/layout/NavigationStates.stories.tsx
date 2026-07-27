import type { Meta, StoryObj } from "@storybook/react";
import NavLink from "./NavLink";
import { NavigationMenu } from "./NavigationMenu";

const meta: Meta = {
  title: "Design System/Navigation States",
  parameters: { layout: "centered" },
};
export default meta;

/** All NavLink states side-by-side */
export const NavLinkStates: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-2 p-6 bg-white rounded-xl w-64">
      <p className="text-xs font-semibold text-gray-400 mb-1">NavLink states</p>
      {/* Active — forced via isActive prop so story works outside Next.js router */}
      <NavLink href="/dashboard" isActive>Active link</NavLink>
      {/* Inactive */}
      <NavLink href="/settings">Inactive link</NavLink>
      {/* Focus-visible — use :focus-visible pseudo in browser devtools or Tab key */}
      <NavLink href="/focus-demo" className="[&:focus-visible]:ring-2 [&:focus-visible]:ring-[#15A350]">
        Focus-visible (Tab to me)
      </NavLink>
    </div>
  ),
};

/** NavigationMenu with a pre-selected active path */
export const NavigationMenuStates: StoryObj = {
  render: () => (
    <div className="w-64 bg-black rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-400 mb-3">NavigationMenu (dark)</p>
      <NavigationMenu visibleLinks={["Dashboard", "Loan", "Transactions", "Settings"]} />
    </div>
  ),
};

/** Token reference card */
export const TokenReference: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3 p-6 bg-gray-50 rounded-xl text-sm font-mono w-80">
      <p className="font-semibold text-gray-600 mb-1">navClasses tokens</p>
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full bg-[#15A350] inline-block" />
        <span>focusRing / activeText / indicatorBar — #15A350</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full bg-[#AAABAB] inline-block" />
        <span>inactiveText — #AAABAB</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded bg-[#15A350]/10 border border-[#15A350] inline-block" />
        <span>activeBgLight — #15A350/10</span>
      </div>
      <div className="flex items-center gap-3 bg-black p-2 rounded">
        <span className="w-4 h-4 rounded bg-[#15A350]/15 border border-[#15A350] inline-block" />
        <span className="text-white">activeBgDark — #15A350/15</span>
      </div>
      <div className="text-gray-500 mt-1">minTouchTarget: 44 px (py-3.5)</div>
    </div>
  ),
};
