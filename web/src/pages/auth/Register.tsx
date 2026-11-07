import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Field, Input, Button } from "@/components/ui";
import AuthShell from "./AuthShell";

const schema = z.object({
  name: z.string().min(2, "Enter your name"),
  orgName: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  password: z.string()
    .min(10, "At least 10 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[0-9]/, "Include at least one number"),
});
type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await registerUser(values);
      navigate("/app", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not create your account.");
    }
  }

  return (
    <AuthShell
      title="Create your buyer account"
      subtitle="Request quotes and manage engagements across the network."
      footer={<>Already have an account? <Link to="/login" className="inline-flex min-h-[44px] items-center font-medium text-brand-700 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label="Full name" error={errors.name?.message}>
          <Input placeholder="Jane Doe" {...register("name")} />
        </Field>
        <Field label="Organization" error={errors.orgName?.message} hint="Optional">
          <Input placeholder="Acme Materials Pvt Ltd" {...register("orgName")} />
        </Field>
        <Field label="Work email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} />
        </Field>
        <Field label="Phone" error={errors.phone?.message} hint="Optional">
          <Input placeholder="+91 90000 00000" {...register("phone")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" placeholder="••••••••" {...register("password")} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthShell>
  );
}
