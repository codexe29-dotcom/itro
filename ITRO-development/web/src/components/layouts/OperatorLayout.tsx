import { ListChecks } from "lucide-react";
import DashboardShell from "./DashboardShell";
import { NavGroup } from "./Sidebar";
import { useAuth } from "@/lib/auth";

const groups: NavGroup[] = [
  {
    items: [{ to: "/operator", label: "Work Queue", icon: ListChecks, end: true }],
  },
];

export default function OperatorLayout() {
  const { user } = useAuth();
  return (
    <DashboardShell
      groups={groups}
      home="/operator"
      topbarTitle={user?.institution?.name || "Operator"}
    />
  );
}
