"use client";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const AUDIENCE: Record<string, string> = { all: "ทุกองค์กร", trial: "ทดลองใช้", paid: "ลูกค้าจ่ายเงิน" };

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("th-TH") : null;
}

export default function AdminAnnouncementsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: superAdminApi.getAnnouncements,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">การแจ้งเตือน / ประกาศ</h1>
        <p className="text-sm text-muted-foreground">ประกาศและแจ้งเตือนถึงองค์กรในระบบ</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีประกาศ" />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((a) => {
            const published = a.status === "published";
            return (
              <div key={a.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Megaphone className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          published ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                      </span>
                      <span className="rounded-full bg-app px-2 py-0.5 text-[10px] text-muted-foreground">
                        {AUDIENCE[a.audience] ?? a.audience}
                      </span>
                    </div>
                    {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
                    {fmtDate(a.publishedAt) && (
                      <p className="mt-1 text-xs text-muted-foreground">เผยแพร่ {fmtDate(a.publishedAt)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
