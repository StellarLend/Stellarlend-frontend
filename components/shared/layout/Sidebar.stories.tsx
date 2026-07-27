import type { Meta, StoryObj } from "@storybook/react";
import Sidebar from "./Sidebar";
import { SidebarProvider } from "@/context/SidebarContext";

const meta: Meta<typeof Sidebar> = {
  title: "Shared/Layout/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Sidebar supports desktop expanded and collapsed rail states, plus a mobile drawer with overlay, focus trapping, and scroll lock.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

export const Expanded: Story = {
  render: () => (
    <div className="min-h-screen bg-slate-50 p-6">
      <SidebarProvider initialSidebarOpen initialIsMobile={false}>
        <Sidebar />
      </SidebarProvider>
    </div>
  ),
};

export const CollapsedRail: Story = {
  render: () => (
    <div className="min-h-screen bg-slate-50 p-6">
      <SidebarProvider initialSidebarOpen={false} initialIsMobile={false}>
        <Sidebar />
      </SidebarProvider>
    </div>
  ),
};

export const MobileDrawer: Story = {
  render: () => (
    <div className="min-h-screen bg-slate-50 p-6">
      <SidebarProvider initialSidebarOpen initialIsMobile>
        <Sidebar />
      </SidebarProvider>
    </div>
  ),
};

export const MobileTrigger: Story = {
  render: () => (
    <div className="min-h-screen bg-slate-50 p-6">
      <SidebarProvider initialSidebarOpen={false} initialIsMobile>
        <Sidebar />
      </SidebarProvider>
    </div>
  ),
};
