import type { TenantTheme } from "@/lib/theme";

export type Tenant = {
  id: string;
  name: string;
  logoText: string;
  lineOaUrl: string;
  phone: string;
  lineId: string;
  facebook: string;
  email: string;
  addressNote: string;
  theme: TenantTheme;
};

// Hardcoded single tenant for milestone 1 (white-label-ready).
export const tenant: Tenant = {
  id: "everyday-badminton",
  name: "Everyday Badminton",
  logoText: "EVERYDAY BADMINTON",
  lineOaUrl: "https://line.me/",
  phone: "081-234-5678",
  lineId: "@everyday.badminton",
  facebook: "Everyday Badminton",
  email: "info@everydaybadminton.com",
  addressNote: "ถ.งามวงศ์วาน จ.นนทบุรี",
  theme: { primary: "#16A34A", secondary: "#16A34A", accent: "#F59E0B", warning: "#F59E0B", danger: "#EF4444" },
};
