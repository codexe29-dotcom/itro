import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { post } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
import AuthShell from "./AuthShell";

const schema = z.object({
  password: z.string()
    .min(10, "At least 10 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[0-9]/, "Include at least one number"),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});
type FormValues = z.infer<typeof schema>;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [message, setMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    if (!token) {
      setRequestError("This reset link is invalid or expired. Request a new one.");
      return;
    }
    setMessage(null);
    setRequestError(null);
    try {
      const response = await post<{ message: string }>("/auth/reset-password", {
        token,
        password: values.password,
      });
      setMessage(response.message);
    } catch (error) {
      const response = (error as { response?: { data?: { message?: string; error?: string } } }).response;
      setRequestError(response?.data?.message ?? response?.data?.error ?? "Could not reset your password.");
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use at least 10 characters, including an uppercase letter and a number."
      footer={<>Back to <Link to="/login" className="font-medium text-brand-700 hover:underline">sign in</Link></>}
    >
      {message ? (
        <div className="space-y-4">
          <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">{message}</p>
          <Link to="/login" className="inline-flex min-h-[44px] items-center font-medium text-brand-700 hover:underline">Continue to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {requestError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{requestError}</p>}
          <Field label="New password" error={errors.password?.message}>
            <Input type="password" autoComplete="new-password" placeholder="At least 10 characters" {...register("password")} />
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" placeholder="Enter your new password again" {...register("confirmPassword")} />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting} disabled={!token}>Reset password</Button>
        </form>
      )}
    </AuthShell>
  );
}
