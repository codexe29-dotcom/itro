import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, get, post, TOKEN_KEY } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  registerProvider: (payload: ProviderRegisterPayload) => Promise<User>;
  refresh: () => Promise<void>;
  logout: () => void;
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
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    get<User>("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await post<{ token: string; user: User }>("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    api.defaults.headers.common.Authorization = `Bearer ${res.token}`;
    setUser(res.user);
    return res.user;
  }

  async function register(payload: RegisterPayload) {
    const res = await post<{ token: string; user: User }>("/auth/register", payload);
    localStorage.setItem(TOKEN_KEY, res.token);
    api.defaults.headers.common.Authorization = `Bearer ${res.token}`;
    setUser(res.user);
    return res.user;
  }

  async function registerProvider(payload: ProviderRegisterPayload) {
    const res = await post<{ token: string; user: User }>("/auth/register-provider", payload);
    localStorage.setItem(TOKEN_KEY, res.token);
    api.defaults.headers.common.Authorization = `Bearer ${res.token}`;
    setUser(res.user);
    return res.user;
  }

  async function refresh() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const u = await get<User>("/auth/me");
      setUser(u);
    } catch { /* keep current user on transient error */ }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
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
