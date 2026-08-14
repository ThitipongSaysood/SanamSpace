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
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
