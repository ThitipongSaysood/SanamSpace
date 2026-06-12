import type { MetadataRoute } from "next";
import { tenant } from "@/config/tenant";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: tenant.name,
    short_name: tenant.name,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: tenant.theme.primary,
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
