import type { Metadata } from "next";

/**
 * Points the browser at the scanner's manifest instead of the customer app's.
 *
 * The page itself is a client component and cannot export metadata, so the
 * link lives on this layout — which is also the only reason this layout exists.
 */
export const metadata: Metadata = {
  title: "สแกน QR — SanamSpace",
  manifest: "/scan/manifest.webmanifest",
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
