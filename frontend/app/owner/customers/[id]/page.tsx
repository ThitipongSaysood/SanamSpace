"use client";
import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Crown, Mail, Phone, Wallet } from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";

const fmt = new Intl.NumberFormat("th-TH");

function thaiDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * One customer, as the counter needs them: who they are, what they are worth,
 * and what they have booked recently.
 */
export default function OwnerCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "customer", id],
    queryFn: () => ownerApi.getCustomer(id),
  });

  if (isLoading) return <Loading rows={4} />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <Link
        href="/owner/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> กลับไปรายชื่อลูกค้า
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        {data.pictureUrl ? (
          // The customer's own LINE photo, when they have one.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.pictureUrl} alt="" className="size-14 rounded-full object-cover ring-1 ring-black/10" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-brand text-xl font-bold text-brand-foreground">
            {data.displayName.trim().charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{data.displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {data.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" /> {data.phone}
              </span>
            )}
            {data.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" /> {data.email}
              </span>
            )}
            <span>ลูกค้าตั้งแต่ {thaiDate(data.joinedAt)}</span>
          </div>
        </div>

        {data.membership?.tier && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent/15 px-3 py-1 text-sm font-semibold text-brand">
            <Crown className="size-4" /> {data.membership.tier}
          </span>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ยอดใช้จ่ายรวม" value={`฿${fmt.format(data.totalSpending)}`} accent />
        <Stat label="การจองทั้งหมด" value={fmt.format(data.bookingsCount)} />
        <Stat label="เข้าใช้บริการ" value={fmt.format(data.visits)} />
        <Stat
          label="วอลเล็ต"
          value={`฿${fmt.format(data.walletBalance)}`}
          icon={<Wallet className="size-4 text-muted-foreground" />}
        />
      </div>

      {data.membership && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="text-sm text-muted-foreground">คะแนนสะสม</div>
          <div className="text-2xl font-bold">{fmt.format(data.membership.points)}</div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h2 className="font-semibold">การจองล่าสุด</h2>
          <span className="text-xs text-muted-foreground">
            {data.recentBookings.length < data.bookingsCount
              ? `แสดง ${data.recentBookings.length} จาก ${fmt.format(data.bookingsCount)} รายการ`
              : `${data.recentBookings.length} รายการ`}
          </span>
        </header>

        {data.recentBookings.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">ยังไม่เคยจอง</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">รหัส</th>
                  <th className="px-4 py-3">คอร์ท</th>
                  <th className="px-4 py-3">วันและเวลา</th>
                  <th className="px-4 py-3">ยอด</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-app/60">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.code ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{b.courtName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-3.5 text-muted-foreground" />
                        {thaiDate(b.date)} · {b.start}–{b.end}
                      </span>
                    </td>
                    <td className="px-4 py-3">฿{fmt.format(b.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 text-2xl font-bold ${accent ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}
