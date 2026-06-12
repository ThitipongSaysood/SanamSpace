"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!user) router.replace("/login"); }, [user, router]);
  if (!user) return null;
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-16">
      {children}
      <BottomNav />
    </div>
  );
}
