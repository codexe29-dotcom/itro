import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ArrowRight, Rocket, Sparkles } from "lucide-react";
import { fetchProviderSetup } from "@/lib/providerCatalog";
import { Card, CardBody } from "@/components/ui";

interface Step {
  key: string;
  title: string;
  desc: string;
  to: string;
  cta: string;
  done: boolean;
  hint?: string;
}

/**
 * Self-service onboarding checklist for providers. Detects what the institution
 * has set up and guides them, in order, through the steps needed to start
 * receiving orders - no assistance required. Hides once complete.
 */
export default function SetupChecklist() {
  const { data } = useQuery({ queryKey: ["provider-setup"], queryFn: fetchProviderSetup });
  if (!data) return null;

  const steps: Step[] = [
    {
      key: "profile",
      title: "Complete your organisation profile",
      desc: "Add your about text, city and accreditations so buyers trust you.",
      to: "/admin/settings", cta: "Edit profile",
      done: data.profileComplete,
    },
    {
      key: "facility",
      title: "Add a facility",
      desc: "A facility is a lab or department that houses your instruments.",
      to: "/admin/facilities", cta: "Add facility",
      done: data.facilities > 0,
    },
    {
      key: "instrument",
      title: "Add an instrument",
      desc: "Register each machine (UTM, SEM, CNC…) with its capacity and schedule.",
      to: "/admin/instruments", cta: "Add instrument",
      done: data.instruments > 0,
    },
    {
      key: "service",
      title: "Create a service and link its instrument",
      desc: "List what you offer, set pricing, and link the machine it runs on to enable live scheduling.",
      to: "/admin/services", cta: "Add service",
      done: data.services > 0 && data.servicesWithInstrument > 0,
      hint: data.services > 0 && data.servicesWithInstrument === 0
        ? "You have a service but it isn't linked to an instrument - open it and pick the machine."
        : undefined,
    },
    {
      key: "enrol",
      title: "Enrol your services against catalog tests",
      desc: "Offer your service for the tests you perform so buyers can route orders to you.",
      to: "/admin/catalog", cta: "Go to Test Enrolment",
      done: data.enrollments > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // fully onboarded - hide

  const next = steps.find((s) => !s.done);

  return (
    <Card className="mb-6 overflow-hidden border-brand-200">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-brand-950 to-brand-800 px-5 py-4 text-white">
        <div className="flex items-center gap-2.5">
          <Rocket className="h-5 w-5 text-accent-cyan" />
          <div>
            <h2 className="font-semibold">Get set up to receive orders</h2>
            <p className="text-xs text-brand-100/80">Follow these steps - you can do it all yourself.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{doneCount}/{steps.length}</p>
          <p className="text-[11px] text-brand-100/70">completed</p>
        </div>
      </div>
      <CardBody className="space-y-2">
        {steps.map((s) => {
          const isNext = next?.key === s.key;
          return (
            <div key={s.key} className={`flex items-start gap-3 rounded-lg border p-3 transition ${isNext ? "border-brand-300 bg-brand-50/60" : "border-surface-border"}`}>
              {s.done
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                : <Circle className={`mt-0.5 h-5 w-5 shrink-0 ${isNext ? "text-brand-500" : "text-ink-faint"}`} />}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${s.done ? "text-ink-muted line-through" : "text-ink"}`}>{s.title}</p>
                {!s.done && <p className="text-xs text-ink-muted">{s.desc}</p>}
                {s.hint && <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700"><Sparkles className="h-3 w-3" /> {s.hint}</p>}
              </div>
              {!s.done && (
                <Link to={s.to} className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isNext ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-surface-border text-brand-700 hover:bg-surface-muted"}`}>
                  {s.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
