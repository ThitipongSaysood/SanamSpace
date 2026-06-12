"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { tenant } from "@/config/tenant";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <div className="text-2xl font-bold text-brand">{tenant.logoText}</div>
        <p className="mt-2 text-muted-foreground">จองสนามง่าย ๆ ผ่านมือถือ</p>
      </div>
      <Button className="w-full max-w-xs bg-brand hover:bg-brand/90"
        onClick={() => { login(); router.replace("/"); }}>
        เข้าสู่ระบบด้วย LINE
      </Button>
      <p className="text-xs text-muted-foreground">* เดโม่: จำลองการเข้าสู่ระบบ (ยังไม่ต่อ LINE LIFF จริง)</p>
    </main>
  );
}
