import { LayoutDashboard, Building2, Users, ClipboardList, Landmark, Percent, Package, Plug, Ticket } from "lucide-react";
import DashboardShell from "./DashboardShell";
import { NavGroup } from "./Sidebar";

const groups: NavGroup[] = [
  {
    title: "Network",
    items: [
      { to: "/platform", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/platform/providers", label: "Providers", icon: Building2 },
      { to: "/platform/buyers", label: "Buyers", icon: Users },
      { to: "/platform/orders", label: "Orders", icon: ClipboardList },
      { to: "/platform/settlements", label: "Settlements", icon: Landmark },
      { to: "/platform/catalog", label: "Test catalog", icon: Package },
      { to: "/platform/fee-config", label: "Platform fee", icon: Percent },
      { to: "/platform/discounts", label: "Discounts & credits", icon: Ticket },
      { to: "/platform/integrations", label: "Integrations", icon: Plug },
    ],
  },
];

export default function PlatformLayout() {
  return <DashboardShell groups={groups} home="/platform" topbarTitle="Platform console" />;
}
