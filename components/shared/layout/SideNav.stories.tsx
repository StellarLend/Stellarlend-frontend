import type { Meta, StoryObj } from "@storybook/react";
import { SideNav } from "./SideNav";
import { SidebarProvider } from "@/context/SidebarContext";

const meta: Meta<typeof SideNav> = {
  title: "Shared/Layout/SideNav",
  component: SideNav,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "SideNav supports desktop expanded and collapsed rails, plus a mobile drawer with overlay, focus trapping, and scroll lock.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof SideNav>;

export const Expanded: Story = {
  render: () => (
    <div className="min-h-screen bg-slate-950 text-white">
      <SidebarProvider initialSidebarOpen initialIsMobile={false}>
        <SideNav />
      </SidebarProvider>
    </div>
  ),
};

export const CollapsedRail: Story = {
  render: () => (
    <div className="min-h-screen bg-slate-950 text-white">
      <SidebarProvider initialSidebarOpen={false} initialIsMobile={false}>
        <SideNav />
      </SidebarProvider>
    </div>
  ),
};

export const MobileDrawer: Story = {
  render: () => (
    <div className="min-h-screen bg-slate-950 text-white">
      <SidebarProvider initialSidebarOpen initialIsMobile>
        <SideNav />
      </SidebarProvider>
    </div>
  ),
};
