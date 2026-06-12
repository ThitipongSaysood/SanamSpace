"use client";
import { BellRing } from "lucide-react";

export default function NotificationsPage() {
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">การแจ้งเตือน</h1>
      <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
        <div className="grid size-16 place-items-center rounded-full bg-brand/10 text-brand">
          <BellRing className="size-7" />
        </div>
        <p className="text-sm font-medium text-foreground">เร็วๆ นี้</p>
        <p className="text-xs">ระบบแจ้งเตือนกำลังจะมาเร็วๆ นี้</p>
      </div>
    </main>
  );
}
