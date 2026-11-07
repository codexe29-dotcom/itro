import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users as UsersIcon } from "lucide-react";
import { fetchUsers } from "@/lib/queries";
import { post, patch } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { initials } from "@/lib/format";
import {
  PageHeader, Card, CardBody, Table, Badge, Button, Modal,
  Field, Input, Select, LoadingBlock, EmptyState, ErrorState, useToast,
} from "@/components/ui";

const ROLES: Role[] = ["INSTITUTION_ADMIN", "LAB_MANAGER", "OPERATOR", "FACULTY", "RESEARCHER"];

interface FormState { name: string; email: string; role: Role; password: string; }
const EMPTY: FormState = { name: "", email: "", role: "LAB_MANAGER", password: "" };

export default function AdminUsers() {
  const qc = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data, isLoading, isError, error } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const users = data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const create = useMutation({
    mutationFn: () => post("/users", form),
    onSuccess: () => { toast.push("success", "User created."); setModalOpen(false); setForm(EMPTY); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not create user."),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => patch(`/users/${id}`, { role }),
    onSuccess: () => { toast.push("success", "Role updated."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not update role."),
  });

  const toggleActive = useMutation({
    mutationFn: (u: User) => patch(`/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: () => { toast.push("success", "User updated."); invalidate(); },
    onError: (e: any) => toast.push("error", e?.response?.data?.message || "Could not update."),
  });

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Team members in your institution."
        actions={<Button onClick={() => { setForm(EMPTY); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add user</Button>}
      />

      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <ErrorState error={error} />
        ) : users.length === 0 ? (
          <CardBody>
            <EmptyState icon={<UsersIcon className="h-6 w-6" />} title="No users" description="Invite team members to your institution." />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">User</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-subtle">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                        {initials(u.name)}
                      </span>
                      <div>
                        <p className="font-medium text-ink">{u.name}</p>
                        <p className="text-xs text-ink-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <div className="w-44">
                      <Select
                        value={u.role}
                        onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as Role })}
                        className="!py-1.5 text-xs"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                        {!ROLES.includes(u.role) && <option value={u.role}>{u.role.replace(/_/g, " ")}</option>}
                      </Select>
                    </div>
                  </td>
                  <td className="td">
                    <Badge tone={u.isActive ? "success" : "gray"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="td text-right">
                    <Button variant="ghost" className="btn-sm" loading={toggleActive.isPending} onClick={() => toggleActive.mutate(u)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} title="Add user"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              loading={create.isPending}
              disabled={!form.name.trim() || !form.email.trim() || form.password.length < 6}
              onClick={() => create.mutate()}
            >
              Create user
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <Field label="Temporary password" hint="At least 6 characters">
            <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
