import React from "react";
import Sidebar from "../components/shared/layout/Sidebar";
import NavLink from "../components/shared/layout/NavLink";
import { SideNav } from "../components/shared/layout/SideNav";
import { SidebarProvider } from "@/context/SidebarContext.tsx";

export default {
  title: "Navigation/States Showcase",
  component: Sidebar,

    decorators: [
        (Story: any) => (
            <SidebarProvider>
                <Story />
            </SidebarProvider>
        ),
    ],

};

export const SidebarStates = () => (
    <SidebarProvider>
        <Sidebar />
    </SidebarProvider>
);
//
// export const SidebarStates = () => <Sidebar />;

export const NavLinkStates = () => (
  <div style={{ background: "#222", padding: 24 }}>
    <NavLink href="/dashboard" className="mb-2">Dashboard</NavLink>
    <NavLink href="/dashboard/settings">Settings</NavLink>
  </div>
);

export const SideNavStates = () => <SideNav />;
