import type { MetadataRoute } from "next";

/**
 * The scanner's own manifest, served beside the scanner rather than at the root.
 *
 * Next's `app/manifest.ts` convention allows exactly one manifest, and that one
 * already belongs to the customer app — a customer installing the venue's app
 * must get the venue's app, not a staff tool. A PWA manifest is only ever a URL
 * named by `<link rel="manifest">` (see app/scan/layout.tsx), so the counter's
 * scanner gets its own here and the two installs stay separate.
 *
 * `start_url` is /scan rather than the portal home on purpose: tapping the
 * home-screen icon should put the camera in front of whoever is on the desk,
 * not a dashboard they have to navigate out of with a customer waiting.
 */
const manifest: MetadataRoute.Manifest = {
  name: "SanamSpace สแกน",
  short_name: "สแกน",
  description: "สแกน QR เช็คอินและรับของรางวัลที่เคาน์เตอร์",
  start_url: "/scan",
  scope: "/scan",
  display: "standalone",
  orientation: "portrait",
  background_color: "#020617",
  theme_color: "#16a34a",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
