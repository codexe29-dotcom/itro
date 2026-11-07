import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AUTH_UNAUTHORIZED_EVENT, get, post } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  registerProvider: (payload: ProviderRegisterPayload) => Promise<User>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export interface RegisterPayload {
  name: string; email: string; password: string; orgName?: string; phone?: string;
}

export interface ProviderRegisterPayload {
  institutionName: string; type?: string; city?: string; state?: string; country?: string;
  contactName: string; email: string; password: string; phone?: string;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    localStorage.removeItem("rix_token");
    get<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  async function login(email: string, password: string) {
    const res = await post<{ user: User }>("/auth/login", { email, password });
    setUser(res.user);
    return res.user;
  }

  async function register(payload: RegisterPayload) {
    const res = await post<{ user: User }>("/auth/register", payload);
    setUser(res.user);
    return res.user;
  }

  async function registerProvider(payload: ProviderRegisterPayload) {
    const res = await post<{ user: User }>("/auth/register-provider", payload);
    setUser(res.user);
    return res.user;
  }

  async function refresh() {
    const u = await get<User>("/auth/me");
    setUser(u);
  }

  async function logout() {
    await post<void>("/auth/logout");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, registerProvider, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const ADMIN_ROLES = ["INSTITUTION_ADMIN", "LAB_MANAGER", "SUPER_ADMIN"];
export const isAdmin = (u?: User | null) => !!u && ADMIN_ROLES.includes(u.role);
export const isPlatform = (u?: User | null) => u?.role === "SUPER_ADMIN";
export const isOperator = (u?: User | null) => u?.role === "OPERATOR";
export const isBuyer = (u?: User | null) => u?.role === "INDUSTRY_BUYER";
