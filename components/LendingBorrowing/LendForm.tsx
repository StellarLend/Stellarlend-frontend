"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface LendingTabsProps {
  activeTab: "lend" | "borrow"
  setActiveTab: (tab: "lend" | "borrow") => void
}

export default function LendingTabs({ activeTab, setActiveTab }: LendingTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "lend" | "borrow")} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="lend" className="text-lg">
          Lend
        </TabsTrigger>
        <TabsTrigger value="borrow" className="text-lg">
          Borrow
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
