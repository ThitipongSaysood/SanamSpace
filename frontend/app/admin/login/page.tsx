"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { superAdminApi, SuperAdminApiError } from "@/lib/api/superadmin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await superAdminApi.adminLogin(email, password);
      router.replace("/admin");
    } catch (err) {
      setError(
        err instanceof SuperAdminApiError && err.status === 401
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง"
      );
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
            <ShieldCheck className="size-8" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">SanamSpace · Platform Admin</div>
            <p className="text-sm text-muted-foreground">ระบบจัดการแพลตฟอร์ม</p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">อีเมล</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="super@sanamspace.test"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">รหัสผ่าน</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-brand-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          เดโม่: super@sanamspace.test / password
        </p>
      </div>
    </main>
  );
}
