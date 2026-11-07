import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { post } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
import AuthShell from "./AuthShell";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [message, setMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setMessage(null);
    setRequestError(null);
    try {
      const response = await post<{ message: string }>("/auth/forgot-password", values);
      setMessage(response.message);
    } catch (error) {
      const response = (error as { response?: { data?: { message?: string; error?: string } } }).response;
      setRequestError(response?.data?.message ?? response?.data?.error ?? "Could not request a password reset.");
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we’ll send a reset link if the account exists."
      footer={<>Remembered your password? <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {message && <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">{message}</p>}
        {requestError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{requestError}</p>}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
    </AuthShell>
  );
}
