import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
export const TOKEN_KEY = "rix_token";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !location.pathname.startsWith("/login")) {
      localStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(err);
  }
);

// Small typed helpers
export async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get<T>(url, { params });
  return data;
}
export async function post<T>(url: string, body?: object): Promise<T> {
  const { data } = await api.post<T>(url, body);
  return data;
}
export async function patch<T>(url: string, body?: object): Promise<T> {
  const { data } = await api.patch<T>(url, body);
  return data;
}
export async function del<T>(url: string): Promise<T> {
  const { data } = await api.delete<T>(url);
  return data;
}

/** Upload a single image file (multipart/form-data). Returns the public URL. */
export async function uploadFile(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  // Let axios set the multipart boundary Content-Type automatically.
  const { data } = await api.post<{ url: string }>("/uploads", form);
  return data;
}
