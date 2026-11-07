import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { ArrowLeft, ShieldCheck, Clock, Building2 } from "lucide-react";
import { fetchService } from "@/lib/queries";
import { post } from "@/lib/api";
import type { ServiceOrder } from "@/lib/types";
import { money } from "@/lib/format";
import {
  Card, CardBody, Badge, Field, Input, Textarea, Button,
  LoadingBlock, ErrorState, useToast,
} from "@/components/ui";

const schema = z.object({
  quantity: z.coerce.number().int().min(1, "At least 1"),
  sampleDetails: z.string().min(3, "Describe your sample"),
  requirements: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function RequestQuote() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: service, isLoading, isError, error } = useQuery({
    queryKey: ["service", serviceId],
    queryFn: () => fetchService(serviceId!),
    enabled: !!serviceId,
  });

  const { register, handleSubmit, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { quantity: 1 } });

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      post<ServiceOrder>("/orders", { serviceId, ...values }),
    onSuccess: (order) => {
      toast.push("success", "Quote requested.");
      qc.invalidateQueries({ queryKey: ["orders"] });
      navigate(`/app/orders/${order.id}`);
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not submit request."),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !service) return <ErrorState error={error} />;

  const currency = service.institution?.currency;

  return (
    <div>
      <Link to="/exchange" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to catalog
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardBody>
            <h1 className="text-xl font-bold tracking-tight text-ink">Request a quote</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Tell the provider about your sample and requirements. They'll respond with pricing and an SLA.
            </p>
            <form onSubmit={handleSubmit((v) => create.mutate(v))} className="mt-6 space-y-4">
              <Field label="Quantity" error={errors.quantity?.message}>
                <Input type="number" min={1} {...register("quantity")} />
              </Field>
              <Field label="Sample details" error={errors.sampleDetails?.message}>
                <Textarea rows={4} placeholder="Material, form, condition, hazards…" {...register("sampleDetails")} />
              </Field>
              <Field label="Requirements" error={errors.requirements?.message} hint="Optional - standards, deadlines, special handling">
                <Textarea rows={3} placeholder="e.g. Report per ASTM E8, needed within 10 days" {...register("requirements")} />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Link to="/exchange"><Button type="button" variant="secondary">Cancel</Button></Link>
                <Button type="submit" loading={create.isPending}>Submit request</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Service summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody>
              <Badge tone="gray">{service.category}</Badge>
              <h2 className="mt-2 font-semibold text-ink">{service.name}</h2>
              {service.institution && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                  <Building2 className="h-4 w-4" /> {service.institution.name}
                </p>
              )}
              <div className="mt-4 space-y-2 border-t border-surface-border pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Industry price</span>
                  <span className="font-semibold text-ink">{money(service.priceIndustry, currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Turnaround</span>
                  <span className="inline-flex items-center gap-1 text-ink-soft"><Clock className="h-4 w-4" /> {service.turnaroundDays}d</span>
                </div>
                {service.accreditation && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Accreditation</span>
                    <span className="inline-flex items-center gap-1 font-medium text-success">
                      <ShieldCheck className="h-4 w-4" /> {service.accreditation}
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-ink-faint">
                Final price is confirmed by the provider in their quote.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
