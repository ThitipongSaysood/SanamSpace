"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Feather, MessageCircle, Phone, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { isLiffEnabled } from "@/lib/auth/liff";
import { tenant } from "@/config/tenant";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      await login();
      router.replace("/");
    } catch {
      setError("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="grid size-20 place-items-center rounded-3xl bg-brand text-brand-foreground shadow-sm">
          <Feather className="size-9" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight">{tenant.logoText}</div>
        <p className="text-sm text-muted-foreground">จองสนามง่าย ๆ ผ่านมือถือ</p>
      </div>

      <div className="mt-10 w-full max-w-xs">
        <h1 className="mb-5 text-lg font-semibold">เข้าสู่ระบบ</h1>
        <div className="space-y-3">
          <Button
            disabled={busy}
            className="h-12 w-full gap-2 rounded-xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
            onClick={handleLogin}
          >
            <MessageCircle className="size-5" />
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย LINE"}
          </Button>
          {error && <p className="text-sm text-brand-danger">{error}</p>}
          <Button
            variant="outline"
            disabled
            className="h-12 w-full gap-2 rounded-xl border-border text-base font-medium"
          >
            <Phone className="size-5" />
            เข้าสู่ระบบด้วยเบอร์โทร
          </Button>
          <Button
            variant="outline"
            disabled
            className="h-12 w-full gap-2 rounded-xl border-border text-base font-medium"
          >
            <Mail className="size-5" />
            เข้าสู่ระบบด้วยอีเมล
          </Button>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          ยังไม่มีบัญชี?{" "}
          <span className="font-semibold text-brand">สมัครสมาชิก</span>
        </p>
        {!isLiffEnabled() && (
          <p className="mt-6 text-xs text-muted-foreground">
            * เดโม่: จำลองการเข้าสู่ระบบ (ยังไม่ต่อ LINE LIFF จริง)
          </p>
        )}
      </div>
    </main>
  );
}
