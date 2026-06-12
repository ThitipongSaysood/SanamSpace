import type { Metadata } from "next";
import { Prompt, Inter } from "next/font/google";
import { tenant } from "@/config/tenant";
import { themeToCssVars } from "@/lib/theme";
import { Providers } from "@/providers";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-prompt",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: tenant.name,
  description: `จองสนามกับ ${tenant.name}`,
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cssVars = themeToCssVars(tenant.theme) as React.CSSProperties;
  return (
    <html lang="th">
      <body
        className={`${prompt.variable} ${inter.variable} font-[family-name:var(--font-prompt)] antialiased`}
        style={cssVars}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
