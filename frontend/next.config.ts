import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean, self-contained server bundle for Docker / production deploys.
  output: "standalone",

  /**
   * Private-network addresses allowed to request the dev server.
   *
   * Next blocks cross-origin requests to dev-only assets by default, so opening
   * the app from a phone on the same Wi-Fi served the HTML and then answered
   * 403 to every `_next/static/chunks/*` file — the page sat on the loading
   * screen forever with nothing in the UI to say why.
   *
   * Development only (Next ignores it in a production build), and deliberately
   * limited to the RFC1918 ranges a home or office LAN uses rather than `*`.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],

  /**
   * In development, serve the API and uploaded files from THIS origin.
   *
   * Production already works this way — nginx puts Laravel and Next behind one
   * hostname, which is why `NEXT_PUBLIC_API_URL` is `/api/v1` there. Development
   * was the odd one out, pointing the browser at a second origin on port 8000,
   * and that difference cost real time:
   *
   *  - Opening the app from a phone meant editing .env.local to the machine's
   *    LAN IP, and again whenever the Wi-Fi changed.
   *  - The camera needs a secure origin, and an https page cannot call an http
   *    API — mixed content blocks it. One origin removes the problem instead of
   *    working around it.
   *
   * `/storage` is here too because uploads come back as absolute URLs built
   * from Laravel's APP_URL; without the proxy every venue logo and slip would
   * be blocked on an https page.
   */
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];

    const backend = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/storage/:path*", destination: `${backend}/storage/:path*` },
    ];
  },
};

export default nextConfig;
