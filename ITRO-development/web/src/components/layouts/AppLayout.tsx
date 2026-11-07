import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Store, ClipboardList, Receipt, ShoppingCart, Package } from "lucide-react";
import DashboardShell from "./DashboardShell";
import { NavGroup } from "./Sidebar";
import { useAuth } from "@/lib/auth";
import { fetchCart } from "@/lib/queries";

const groups: NavGroup[] = [
  {
    title: "Browse & buy",
    items: [
      { to: "/exchange", label: "Browse catalog", icon: Store },
      { to: "/packages", label: "Certification packages", icon: Package },
    ],
  },
  {
    title: "My account",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/cart", label: "Cart", icon: ShoppingCart },
      { to: "/app/orders", label: "My Orders", icon: ClipboardList },
      { to: "/app/invoices", label: "Invoices", icon: Receipt },
    ],
  },
];

function CartIndicator() {
  const { data: cart } = useQuery({ queryKey: ["cart"], queryFn: fetchCart });
  const count = cart?.lines?.length ?? 0;
  return (
    <Link
      to="/cart"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-subtle hover:text-ink"
      aria-label="Cart"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  return (
    <DashboardShell
      groups={groups}
      home="/app"
      topbarTitle={user?.orgName || "Buyer portal"}
      topbarExtra={<CartIndicator />}
    />
  );
}
