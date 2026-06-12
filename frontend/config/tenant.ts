import type { TenantTheme } from "@/lib/theme";

export type Tenant = {
  id: string;
  name: string;
  logoText: string;
  lineOaUrl: string;
  theme: TenantTheme;
};

// Hardcoded single tenant for milestone 1 (white-label-ready).
export const tenant: Tenant = {
  id: "everyday-badminton",
  name: "Everyday Badminton",
  logoText: "EVERYDAY BADMINTON",
  lineOaUrl: "https://line.me/",
  theme: { primary: "#16A34A", warning: "#F59E0B", danger: "#EF4444" },
};
