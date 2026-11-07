import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export interface PlatformConfig {
  platformName: string;
  tagline: string;
  primaryColor: string;
  defaultCurrency: string;
}

const FALLBACK: PlatformConfig = {
  platformName: "ITRO",
  tagline: "Indian Testing & Research Organisation",
  primaryColor: "#0000ff",
  defaultCurrency: "INR",
};

export function useConfig() {
  const query = useQuery({
    queryKey: ["config"],
    queryFn: () => get<PlatformConfig>("/config"),
    staleTime: 1000 * 60 * 60,
  });
  // Always return a usable config object so chrome never renders blank.
  return { ...query, config: query.data ?? FALLBACK };
}
