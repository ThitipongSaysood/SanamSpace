"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { tenant } from "@/config/tenant";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-brand to-emerald-700 px-6 py-12 text-center text-white">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 size-64 rounded-full bg-black/10" />

      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="grid size-20 place-items-center rounded-3xl bg-white/15 text-4xl shadow-sm ring-1 ring-white/20">
          🏸
        </div>
        <div className="mt-3 text-3xl font-bold tracking-tight">{tenant.logoText}</div>
        <p className="text-white/85">จองสนามง่าย ๆ ผ่านมือถือ</p>
      </div>

      <div className="relative w-full max-w-xs space-y-4">
        <Button
          className="h-12 w-full rounded-xl bg-white text-base font-semibold text-brand shadow-sm hover:bg-white/90"
          onClick={() => {
            login();
            router.replace("/");
          }}
        >
          เข้าสู่ระบบด้วย LINE
        </Button>
        <p className="text-xs text-white/75">* เดโม่: จำลองการเข้าสู่ระบบ (ยังไม่ต่อ LINE LIFF จริง)</p>
      </div>
    </main>
  );
}
