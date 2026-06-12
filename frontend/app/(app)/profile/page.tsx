"use client";
import { UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">โปรไฟล์</h1>
      {user && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <UserCircle className="size-7" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold">{user.displayName}</div>
            <div className="truncate text-xs text-muted-foreground">{user.lineId}</div>
          </div>
        </div>
      )}
      <div className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
        <div className="grid size-16 place-items-center rounded-full bg-brand/10 text-brand">
          <UserCircle className="size-7" />
        </div>
        <p className="text-sm font-medium text-foreground">เร็วๆ นี้</p>
        <p className="text-xs">การตั้งค่าโปรไฟล์กำลังจะมาเร็วๆ นี้</p>
      </div>
    </main>
  );
}
