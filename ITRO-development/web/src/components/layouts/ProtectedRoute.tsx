import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { LoadingBlock } from "@/components/ui";

export function homeForRole(role?: Role) {
  switch (role) {
    case "SUPER_ADMIN": return "/platform";
    case "OPERATOR": return "/operator";
    case "INDUSTRY_BUYER": return "/app";
    case "INSTITUTION_ADMIN":
    case "LAB_MANAGER":
      return "/admin";
    default: return "/app";
  }
}

/**
 * Guards a route. If unauthenticated → /login. If `roles` provided and the
 * user's role is not allowed → redirect them to their own role home.
 */
export default function ProtectedRoute({
  children, roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <LoadingBlock label="Loading your workspace…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
