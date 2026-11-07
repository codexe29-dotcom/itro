import {
  LayoutDashboard, BarChart3, ClipboardList, CalendarCheck, ListChecks,
  Building2, Microscope, Package, Receipt, Users, Settings, UserCog, Ticket, Boxes, CalendarDays,
} from "lucide-react";
import DashboardShell from "./DashboardShell";
import { NavGroup } from "./Sidebar";
import { useAuth } from "@/lib/auth";

const groups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/admin/orders", label: "Service Orders", icon: ClipboardList },
      { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
      { to: "/admin/queue", label: "Operator Queue", icon: ListChecks },
    ],
  },
  {
    title: "Catalog",
    items: [
      { to: "/admin/facilities", label: "Facilities", icon: Building2 },
      { to: "/admin/instruments", label: "Instruments", icon: Microscope },
      { to: "/admin/services", label: "Testing services", icon: Package },
      { to: "/admin/bundles", label: "Bundles", icon: Boxes },
      { to: "/admin/events", label: "Events", icon: CalendarDays },
      { to: "/admin/experts", label: "Skilled Resources", icon: UserCog },
      { to: "/admin/catalog", label: "My tests", icon: ListChecks },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/admin/invoices", label: "Invoices", icon: Receipt },
      { to: "/admin/discounts", label: "Discounts & credits", icon: Ticket },
    ],
  },
  {
    title: "Organization",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const inst = user?.institution;
  return (
    <DashboardShell
      groups={groups}
      home="/admin"
      topbarTitle={
        <span className="flex items-center gap-2 min-w-0">
          {inst?.logoUrl && (
            <img
              src={inst.logoUrl}
              alt=""
              className="h-6 w-6 shrink-0 rounded object-contain"
            />
          )}
          <span className="truncate">{inst?.name || "Admin console"}</span>
        </span>
      }
    />
  );
}
