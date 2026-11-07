import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, IndianRupee, ClipboardList, Activity, Package,
  Star, MapPin, ExternalLink, Landmark, Users, UserCog, Navigation, Plus,
} from "lucide-react";
import { fetchPlatformProvider } from "@/lib/queries";
import { post } from "@/lib/api";
import { useConfig } from "@/lib/useConfig";
import { money, dateShort, orderLabel } from "@/lib/format";
import MapView from "@/components/MapView";
import {
  Card, CardBody, Table, StatCard, StatusBadge, Badge, Button, Modal, Field, Input, Select, useToast,
  LoadingBlock, ErrorState, EmptyState,
} from "@/components/ui";

const typeLabel = (t: string) =>
  t.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

export default function PlatformProviderDetail() {
  const { id } = useParams<{ id: string }>();
  const { config } = useConfig();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["platform-provider", id],
    queryFn: () => fetchPlatformProvider(id!),
    enabled: !!id,
  });

  const qc = useQueryClient();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "INSTITUTION_ADMIN", password: "" });
  const addUser = useMutation({
    mutationFn: () => post(`/platform/providers/${id}/users`, form),
    onSuccess: () => {
      toast.push("success", "Login created for this provider.");
      qc.invalidateQueries({ queryKey: ["platform-provider", id] });
      setAddOpen(false);
      setForm({ name: "", email: "", role: "INSTITUTION_ADMIN", password: "" });
    },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not create login."),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <ErrorState error={error} />;

  const { institution: inst, stats, settlements, facilities, services, users, recentOrders } = data;
  const experts = data.experts ?? [];
  const currency = inst.currency || config.defaultCurrency;
  const rateLabel: Record<string, string> = { HOURLY: "/ hr", DAILY: "/ day", PROJECT: "/ project" };

  const hasCoords = typeof inst.latitude === "number" && typeof inst.longitude === "number";
  const addressLines = [
    inst.addressLine1,
    inst.addressLine2,
    [inst.city, inst.state, inst.postalCode].filter(Boolean).join(", "),
    inst.country,
  ].filter(Boolean);
  const directionsHref = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${inst.latitude},${inst.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([inst.name, ...addressLines].filter(Boolean).join(", "))}`;

  return (
    <div>
      <Link to="/platform/providers" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to providers
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-brand-600">
            {inst.logoUrl ? <img src={inst.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-6 w-6" />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-ink">{inst.name}</h1>
              <Badge tone={inst.isPublished ? "brand" : "gray"}>{inst.isPublished ? "Published" : "Draft"}</Badge>
              {inst.onExchange && <Badge tone="gray">On exchange</Badge>}
            </div>
            <p className="mt-1 flex items-center gap-3 text-sm text-ink-muted">
              <span>{typeLabel(inst.type)}</span>
              {(inst.city || inst.country) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {[inst.city, inst.state, inst.country].filter(Boolean).join(", ")}
                </span>
              )}
            </p>
          </div>
        </div>
        <a href={`/institutions/${inst.slug}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
          <ExternalLink className="h-4 w-4" /> Public profile
        </a>
      </div>

      {inst.about && <p className="mt-4 max-w-3xl text-sm text-ink-soft">{inst.about}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={money(stats.revenue, currency)} icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard label="Orders" value={stats.totalOrders} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Pending" value={stats.pendingOrders} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Services" value={stats.services} icon={<Package className="h-5 w-5" />} />
        <StatCard label="Instruments" value={stats.instruments} icon={<Package className="h-5 w-5" />} />
        <StatCard label="Rating" value={stats.avgRating != null ? `${stats.avgRating} (${stats.reviewCount})` : "-"} icon={<Star className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Services / rate card */}
        <Card>
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-semibold text-ink">Services & rate card</h2>
          </div>
          {services.length ? (
            <Table>
              <thead>
                <tr>
                  <th className="th">Service</th>
                  <th className="th">Category</th>
                  <th className="th text-right">Academic</th>
                  <th className="th text-right">Industry</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-subtle">
                    <td className="td font-medium text-ink">{s.name}</td>
                    <td className="td">{s.category}</td>
                    <td className="td text-right">{money(s.priceAcademic, currency)}</td>
                    <td className="td text-right">{money(s.priceIndustry, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <CardBody><EmptyState title="No services" /></CardBody>
          )}
        </Card>

        {/* Settlements summary */}
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-brand-600" />
              <h2 className="font-semibold text-ink">Settlements</h2>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Settlements" value={String(settlements.count)} />
              <Row label="Gross" value={money(settlements.grossAmount, currency)} />
              <Row label="Platform fee" value={money(settlements.platformFee, currency)} />
              <Row label="Net to provider" value={money(settlements.netToProvider, currency)} strong />
              <div className="border-t border-surface-border pt-2">
                <Row label="Pending payout" value={money(settlements.pendingNetToProvider, currency)} />
                <Row label="Pending count" value={String(settlements.pendingCount)} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Facilities & instruments */}
      <Card className="mt-6">
        <div className="border-b border-surface-border px-5 py-4">
          <h2 className="font-semibold text-ink">Facilities & instruments</h2>
        </div>
        {facilities.length ? (
          <div className="divide-y divide-surface-border">
            {facilities.map((f) => (
              <div key={f.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{f.name}</p>
                  <span className="text-xs text-ink-muted">{f.instruments?.length ?? 0} instruments</span>
                </div>
                {f.department && <p className="text-xs text-ink-muted">{f.department}</p>}
                {f.instruments && f.instruments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {f.instruments.map((i) => (
                      <span key={i.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-soft">
                        {i.name}
                        <StatusBadge status={i.status} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <CardBody><EmptyState title="No facilities" /></CardBody>
        )}
      </Card>

      {/* Location */}
      {(hasCoords || addressLines.length > 0) && (
        <Card className="mt-6">
          <div className="flex items-center gap-2 border-b border-surface-border px-5 py-4">
            <MapPin className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-ink">Location</h2>
          </div>
          <CardBody>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                {addressLines.length > 0 && (
                  <address className="not-italic text-sm text-ink-soft">
                    {addressLines.map((line, i) => (
                      <div key={i} className={i === 0 ? "font-medium text-ink" : ""}>{line}</div>
                    ))}
                  </address>
                )}
                <a href={directionsHref} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-4 inline-flex">
                  <Navigation className="h-4 w-4" /> Get directions
                </a>
              </div>
              {hasCoords && (
                <MapView lat={inst.latitude!} lng={inst.longitude!} label={inst.name} height={240} />
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Experts / team */}
      <Card className="mt-6">
        <div className="flex items-center gap-2 border-b border-surface-border px-5 py-4">
          <UserCog className="h-5 w-5 text-brand-600" />
          <h2 className="font-semibold text-ink">Skilled resources / experts</h2>
        </div>
        {experts.length ? (
          <Table>
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Title</th>
                <th className="th">Expertise</th>
                <th className="th text-right">Rate</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {experts.map((x) => (
                <tr key={x.id} className="hover:bg-surface-subtle">
                  <td className="td font-medium text-ink">{x.name}</td>
                  <td className="td">{x.title}</td>
                  <td className="td">
                    {x.expertise && x.expertise.length > 0
                      ? <span className="text-ink-muted">{x.expertise.slice(0, 3).join(", ")}{x.expertise.length > 3 ? "…" : ""}</span>
                      : "-"}
                  </td>
                  <td className="td text-right">{x.rate ? `${money(x.rate, currency)} ${rateLabel[x.ratePeriod] ?? ""}` : "-"}</td>
                  <td className="td"><Badge tone={x.isActive ? "brand" : "gray"}>{x.isActive ? "Active" : "Hidden"}</Badge></td>
                  <td className="td text-right">
                    <a href={`/experts/${x.id}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm inline-flex">View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody><EmptyState title="No experts" description="This provider hasn't listed any skilled resources yet." /></CardBody>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent orders */}
        <Card>
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-semibold text-ink">Recent orders</h2>
          </div>
          {recentOrders.length ? (
            <Table>
              <thead>
                <tr>
                  <th className="th">Order</th>
                  <th className="th">Buyer</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-subtle">
                    <td className="td font-medium text-ink">{o.code}</td>
                    <td className="td">{o.buyer?.orgName || o.buyer?.name || "-"}</td>
                    <td className="td"><StatusBadge status={o.status} label={orderLabel(o.status)} /></td>
                    <td className="td text-right">
                      <Link to={`/platform/orders/${o.id}`} className="btn-ghost btn-sm inline-flex">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <CardBody><EmptyState title="No orders yet" /></CardBody>
          )}
        </Card>

        {/* Users */}
        <Card>
          <div className="flex items-center justify-between gap-2 border-b border-surface-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-600" />
              <h2 className="font-semibold text-ink">Team &amp; logins</h2>
            </div>
            <Button className="btn-sm" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> Add login</Button>
          </div>
          {users.length ? (
            <Table>
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Role</th>
                  <th className="th">Email</th>
                </tr>
              </thead>
              <tbody>
                {users.map((usr) => (
                  <tr key={usr.id} className="hover:bg-surface-subtle">
                    <td className="td font-medium text-ink">{usr.name}</td>
                    <td className="td">{typeLabel(usr.role)}</td>
                    <td className="td text-ink-muted">{usr.email}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <CardBody><EmptyState title="No team members" /></CardBody>
          )}
        </Card>
      </div>

      <p className="mt-6 text-xs text-ink-faint">Provider since {dateShort(inst.createdAt)}.</p>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add provider login"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button loading={addUser.isPending} disabled={!form.name || !form.email || form.password.length < 6} onClick={() => addUser.mutate()}>Create login</Button>
          </div>
        }>
        <p className="text-sm text-ink-muted">Create a login for <span className="font-medium text-ink">{inst.name}</span>. Share these credentials with the provider - they sign in at the Login page and manage their lab from the admin console. An Institution admin can then add their own operators and lab managers.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Contact name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Lab Administrator" /></Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="INSTITUTION_ADMIN">Institution admin (full access)</option>
              <option value="LAB_MANAGER">Lab manager</option>
              <option value="OPERATOR">Operator</option>
            </Select>
          </Field>
        </div>
        <Field label="Email (username)"><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="admin@lab.com" /></Field>
        <Field label="Password" hint="Minimum 6 characters - shown so you can share it"><Input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Set a temporary password" /></Field>
      </Modal>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{value}</span>
    </div>
  );
}
