import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Percent, Coins, Scissors } from "lucide-react";
import clsx from "clsx";
import { fetchFeeConfig, updateFeeConfig } from "@/lib/queries";
import type { FeeMode } from "@/lib/types";
import {
  PageHeader, Card, CardBody, Button, Field, Input,
  LoadingBlock, ErrorState, useToast,
} from "@/components/ui";

const MODES: { value: FeeMode; label: string; icon: JSX.Element; blurb: string; unit: string }[] = [
  {
    value: "MARKUP_PERCENT",
    label: "Markup %",
    icon: <Percent className="h-5 w-5" />,
    blurb: "Add a percentage on top of the provider price. The buyer pays provider price + markup; the provider still receives their full price.",
    unit: "%",
  },
  {
    value: "FIXED_FEE",
    label: "Fixed fee",
    icon: <Coins className="h-5 w-5" />,
    blurb: "Add a flat amount to every priced line. The buyer pays provider price + fee; the provider receives their full price.",
    unit: "flat",
  },
  {
    value: "SETTLEMENT_DEDUCTION",
    label: "Deduct from settlement",
    icon: <Scissors className="h-5 w-5" />,
    blurb: "The buyer pays the provider price as-is; the platform take-rate is deducted from what the provider is settled.",
    unit: "%",
  },
];

export default function FeeSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<FeeMode>("MARKUP_PERCENT");
  const [value, setValue] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["fee-config"],
    queryFn: fetchFeeConfig,
  });

  useEffect(() => {
    if (data) {
      setMode(data.feeMode);
      setValue(String(data.feeValue));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateFeeConfig({ feeMode: mode, feeValue: Number(value) || 0 }),
    onSuccess: () => {
      toast.push("success", "Platform fee updated.");
      qc.invalidateQueries({ queryKey: ["fee-config"] });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not save."),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError) return <ErrorState error={error} />;

  const active = MODES.find((m) => m.value === mode)!;

  return (
    <div>
      <PageHeader
        title="Platform fee"
        subtitle="Set how ITRO earns on each transaction. Applies globally unless a provider has an override."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardBody>
            <p className="label mb-3">Fee mode</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={clsx(
                    "rounded-lg border p-4 text-left transition",
                    mode === m.value ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-surface-border hover:border-brand-300"
                  )}
                >
                  <div className={clsx("mb-2 inline-flex rounded-lg p-2", mode === m.value ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-soft")}>
                    {m.icon}
                  </div>
                  <p className="font-semibold text-ink">{m.label}</p>
                </button>
              ))}
            </div>

            <p className="mt-4 text-sm text-ink-muted">{active.blurb}</p>

            <div className="mt-5 max-w-xs">
              <Field label={active.unit === "%" ? "Value (%)" : "Value (flat amount)"}>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={active.unit === "%" ? "12" : "500"}
                />
              </Field>
            </div>

            <Button className="mt-5" loading={save.isPending} onClick={() => save.mutate()}>
              Save fee config
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="section-title mb-3">Current setting</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Mode</span>
                <span className="font-medium text-ink">{MODES.find((m) => m.value === data?.feeMode)?.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Value</span>
                <span className="font-medium text-ink">
                  {data?.feeValue}{MODES.find((m) => m.value === data?.feeMode)?.unit === "%" ? "%" : ""}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Per-provider overrides (set on a provider's edit modal) take precedence over this global default.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
