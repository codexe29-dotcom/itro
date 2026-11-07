import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { homeForRole } from "@/components/layouts/ProtectedRoute";
import { Field, Input, Button } from "@/components/ui";
import AuthShell from "./AuthShell";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: string })?.from;

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      navigate(from || homeForRole(user.role), { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Invalid email or password.");
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your workspace on the exchange."
      footer={<>New buyer? <Link to="/register" className="inline-flex min-h-[44px] items-center font-medium text-brand-700 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
        </Field>
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>

      <div className="mt-6 rounded-lg border border-surface-border bg-surface-subtle p-3 text-xs text-ink-muted">
        <p className="font-semibold text-ink-soft">Demo logins</p>
        <p className="mt-1">Use the seeded accounts from your environment. Each role (buyer, lab manager, operator, platform admin) routes to its own workspace after sign-in.</p>
      </div>
    </AuthShell>
  );
}
