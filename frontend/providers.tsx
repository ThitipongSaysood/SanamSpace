"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/auth-context";
import { TenantProvider } from "@/lib/tenant/tenant-context";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <TenantProvider>
        <AuthProvider>{children}</AuthProvider>
        {/* One global toaster, top-right, so every save/action can confirm
            itself instead of the screen going silent. */}
        <Toaster position="top-right" richColors closeButton />
      </TenantProvider>
    </QueryClientProvider>
  );
}
