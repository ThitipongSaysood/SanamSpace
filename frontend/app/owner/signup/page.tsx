"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ownerApi, OwnerApiError } from "@/lib/api/owner";

const PLANS: Record<string, string> = { starter: "Starter", business: "Business", pro: "Pro" };

function SignupInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const planCode = sp.get("plan") ?? undefined;
  const planLabel = planCode ? PLANS[planCode] : undefined;

  const [venueName, setVenueName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ownerApi.register({ venueName, ownerName, email, phone: phone || undefined, password, planCode });
      router.replace("/owner");
    } catch (err) {
      setError(
        err instanceof OwnerApiError && err.status === 429
          ? "สมัครบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"
          : err instanceof OwnerApiError && err.status === 422
            ? "สมัครไม่สำเร็จ — อีเมลนี้อาจถูกใช้แล้ว หรือรหัสผ่านสั้นเกินไป (อย่างน้อย 8 ตัว)"
            : "สมัครไม่สำเร็จ ลองใหม่อีกครั้ง",
      );
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
            <Sparkles className="size-8" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">เปิดสนามกับ SanamSpace</div>
            <p className="text-sm text-muted-foreground">
              ทดลองใช้ฟรี 30 วัน{planLabel ? ` · แพ็กเกจ ${planLabel}` : ""}
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="su-venue">ชื่อสนาม</Label>
            <Input id="su-venue" required value={venueName} onChange={(e) => setVenueName(e.target.value)}
              className="h-11 rounded-xl" placeholder="เช่น Everyday Badminton" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-owner">ชื่อเจ้าของ</Label>
            <Input id="su-owner" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
              className="h-11 rounded-xl" placeholder="ชื่อ-นามสกุล" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-email">อีเมล</Label>
            <Input id="su-email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" placeholder="you@venue.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-phone">เบอร์โทร (ไม่บังคับ)</Label>
            <Input id="su-phone" type="tel" autoComplete="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" placeholder="08x-xxx-xxxx" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-password">ตั้งรหัสผ่าน</Label>
            <Input id="su-password" type="password" autoComplete="new-password" required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl"
              placeholder="อย่างน้อย 8 ตัวอักษร" />
          </div>

          {error && <p className="text-sm text-brand-danger">{error}</p>}

          <button type="submit" disabled={busy}
            className="h-11 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-60">
            {busy ? "กำลังสร้างสนาม..." : "เริ่มทดลองใช้ฟรี 30 วัน"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/owner/login" className="font-semibold text-brand hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function OwnerSignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
