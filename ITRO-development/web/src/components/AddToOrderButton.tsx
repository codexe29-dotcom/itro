import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText } from "lucide-react";
import clsx from "clsx";
import type { Service } from "@/lib/types";
import { addToCart } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Button, useToast } from "@/components/ui";

/**
 * "Add to order" for FIXED services, "Request quote" for QUOTE services.
 * Safe to render inside a <Link> - it stops click propagation.
 */
export default function AddToOrderButton({
  service, className, variant = "primary", expedited, label,
}: {
  service: Pick<Service, "id" | "pricingMode">;
  className?: string;
  variant?: "primary" | "secondary";
  expedited?: boolean;
  label?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const isFixed = service.pricingMode === "FIXED";

  const add = useMutation({
    mutationFn: () => addToCart({ serviceId: service.id, expedited }),
    onSuccess: () => {
      toast.push("success", isFixed ? "Added to your order." : "Added as a quote line.");
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not add to order."),
  });

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/login", { state: { from: `/services/${service.id}` } });
      return;
    }
    if (user.role !== "INDUSTRY_BUYER") {
      toast.push("info", "Sign in as a buyer to place orders.");
      return;
    }
    add.mutate();
  }

  return (
    <Button
      variant={variant}
      className={clsx(className)}
      loading={add.isPending}
      onClick={onClick}
    >
      {isFixed ? <Plus className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      {label ?? (isFixed ? "Add to order" : "Add quote line")}
    </Button>
  );
}
