"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  Clock,
  Megaphone,
  ReceiptText,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  BookingStatus,
  CourtBoard,
  OwnerDashboard,
  OwnerRevenuePoint,
} from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { StatusBadge } from "@/components/status-badge";
import { CustomerLink } from "@/components/customer-link";
import { Loading, ErrorState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");
const BRAND = "var(--brand-primary)";

// Donut palette for multi-series charts (brand green + supporting hues).
const STATUS_COLORS = { completed: "#16A34A", pending: "#F59E0B", cancelled: "#EF4444" };
const SPORT_COLORS = ["#16A34A", "#0EA5E9", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6"];

const SPORT_LABELS: Record<string, string> = {
  badminton: "แบดมินตัน",
  football: "ฟุตบอล",
  futsal: "ฟุตซอล",
  tennis: "เทนนิส",
};

const CHANNEL_LABELS: Record<string, string> = {
  app: "แอปพลิเคชัน",
  walk_in: "หน้าร้าน",
  "walk-in": "หน้าร้าน",
  walkin: "หน้าร้าน",
  phone: "โทรศัพท์",
  line: "LINE",
  web: "เว็บไซต์",
  staff: "พนักงาน",
};

// recentBookings.status arrives as a free-form string; map it to a BookingStatus
// so it renders through the shared StatusBadge. Unknown values fall back sensibly.
function toBookingStatus(s: string): BookingStatus {
  switch (s) {
    case "confirmed":
      return "confirmed";
    case "completed":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "pending":
    case "pending_payment":
    case "pending_review":
    case "awaiting_slip":
      return "pending_payment";
    default:
      return "confirmed";
  }
}

function sportLabel(s: string) {
  return SPORT_LABELS[s] ?? s;
}
function channelLabel(c: string) {
  return CHANNEL_LABELS[c] ?? c;
}

// ---- Stat cards -----------------------------------------------------------

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tint: string; // tailwind classes for the icon square
  series: OwnerRevenuePoint[];
  stroke: string;
  delta?: number; // real percent vs yesterday (omitted when not applicable)
};

function StatCard({ label, value, icon: Icon, tint, series, stroke, delta }: StatCardProps) {
  const hasDelta = typeof delta === "number";
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <span className={`grid size-10 place-items-center rounded-xl ${tint}`}>
          <Icon className="size-5" />
        </span>
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-brand" : "text-red-500"}`}>
            <ArrowUpRight className={`size-3.5 ${up ? "" : "rotate-90"}`} />
            {up ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{hasDelta ? "จากเมื่อวาน" : ""}</span>
        <div className="h-8 w-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={stroke}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CardShell({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---- Dashboard ------------------------------------------------------------

export default function OwnerDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "dashboard"],
    queryFn: ownerApi.getDashboard,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard 👋</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมธุรกิจของคุณวันนี้</p>
      </header>

      <PlatformAnnouncements />
      <VenueCustomerLink />

      {isLoading && <Loading rows={3} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <DashboardBody d={data} />}
    </div>
  );
}

// The booking link this venue hands out. On the dashboard because sharing it is
// a daily job, not a one-off setting.
function VenueCustomerLink() {
  const { data } = useQuery({ queryKey: ["owner", "settings"], queryFn: ownerApi.getSettings });
  return <CustomerLink slug={data?.orgSlug} />;
}

// Published announcements from the platform (Super Admin), targeted to this org.
function PlatformAnnouncements() {
  const { data } = useQuery({ queryKey: ["owner", "announcements"], queryFn: ownerApi.getAnnouncements });
  if (!data || data.length === 0) return null;
  return (
    <div className="space-y-2">
      {data.map((a) => (
        <div key={a.id} className="flex gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <Megaphone className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <div className="font-semibold text-amber-900">{a.title}</div>
            {a.body && <p className="mt-0.5 text-sm text-amber-800">{a.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardBody({ d }: { d: OwnerDashboard }) {
  const series = d.revenueSeries ?? [];
  const totalRevenue = series.reduce((sum, p) => sum + p.revenue, 0);

  // Real day-over-day deltas come from the backend; utilization/wallet have none.
  const stats: StatCardProps[] = [
    {
      label: "รายได้วันนี้",
      value: `฿${fmt.format(d.todayRevenue)}`,
      icon: TrendingUp,
      tint: "bg-brand/10 text-brand",
      series,
      stroke: BRAND,
      delta: d.deltas?.todayRevenue,
    },
    {
      label: "การจองวันนี้",
      value: `${fmt.format(d.todayBookings)} รายการ`,
      icon: CalendarCheck,
      tint: "bg-sky-100 text-sky-600",
      series,
      stroke: "#0EA5E9",
      delta: d.deltas?.todayBookings,
    },
    {
      label: "ลูกค้าใหม่วันนี้",
      value: `${fmt.format(d.newCustomersToday)} คน`,
      icon: Users,
      tint: "bg-violet-100 text-violet-600",
      series,
      stroke: "#8B5CF6",
      delta: d.deltas?.newCustomersToday,
    },
    {
      label: "อัตราการใช้งานสนาม",
      value: `${d.utilizationRate}%`,
      icon: CalendarDays,
      tint: "bg-amber-100 text-amber-600",
      series,
      stroke: "#F59E0B",
    },
    {
      label: "ยอดเงินในวอลเล็ต",
      value: `฿${fmt.format(d.walletBalance)}`,
      icon: Wallet,
      tint: "bg-emerald-100 text-emerald-600",
      series,
      stroke: "#10B981",
    },
  ];

  // Donut: bookings by status.
  const sb = d.statusBreakdown;
  const statusData = [
    { key: "completed", label: "เสร็จสิ้น", value: sb.completed, color: STATUS_COLORS.completed },
    { key: "pending", label: "รอชำระเงิน", value: sb.pending, color: STATUS_COLORS.pending },
    { key: "cancelled", label: "ยกเลิก", value: sb.cancelled, color: STATUS_COLORS.cancelled },
  ];
  const statusTotal = sb.total || statusData.reduce((s, x) => s + x.value, 0);

  // Channels (horizontal bars).
  const channels = d.bookingChannels ?? [];
  const channelMax = Math.max(1, ...channels.map((c) => c.count));
  const channelTotal = channels.reduce((s, c) => s + c.count, 0) || 1;

  // Sport sales donut.
  const sports = d.sportSales ?? [];
  const sportTotal = sports.reduce((s, x) => s + x.revenue, 0);

  // Action items.
  const ai = d.actionItems;
  const actions = [
    {
      label: "สลิปรอตรวจสอบ",
      count: ai.pendingSlips,
      icon: ReceiptText,
      tint: "bg-amber-100 text-amber-600",
      href: "/owner/payments" as const,
    },
    {
      label: "ลูกค้าใกล้ถึงเวลา",
      count: ai.nearTime,
      icon: Clock,
      tint: "bg-sky-100 text-sky-600",
    },
    {
      label: "การจองวันนี้",
      count: ai.todayBookings,
      icon: CalendarCheck,
      tint: "bg-brand/10 text-brand",
    },
    {
      label: "การจองยกเลิก",
      count: ai.cancelledToday,
      icon: XCircle,
      tint: "bg-red-100 text-red-600",
    },
  ];

  const recent = d.recentBookings ?? [];

  return (
    <div className="space-y-5">
      <CourtBoardPanel />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Row: revenue + status donut + today calendar */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue area chart */}
        <CardShell
          title="รายได้รวม"
          className="lg:col-span-1"
          action={<span className="text-xs text-muted-foreground">7 วันล่าสุด</span>}
        >
          <div className="text-2xl font-bold tracking-tight">฿{fmt.format(totalRevenue)}</div>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={8}
                />
                <Tooltip
                  formatter={(v) => [`฿${fmt.format(Number(v))}`, "รายได้"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={BRAND}
                  strokeWidth={2}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardShell>

        {/* Status donut */}
        <CardShell title="การจองตามสถานะ">
          <div className="flex items-center gap-4">
            <div className="relative h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={66}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {statusData.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [fmt.format(Number(v)), n as string]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{fmt.format(statusTotal)}</span>
                <span className="text-[11px] text-muted-foreground">รายการ</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {statusData.map((s) => {
                const pct = statusTotal ? Math.round((s.value / statusTotal) * 100) : 0;
                return (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-muted-foreground">{s.label}</span>
                    <span className="font-semibold">{fmt.format(s.value)}</span>
                    <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </CardShell>

        {/* Today calendar */}
        <CardShell
          title="ปฏิทินวันนี้"
          action={
            <Link href="/owner/bookings" className="text-xs font-medium text-brand">
              ดูทั้งหมด
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีรายการวันนี้</p>
          ) : (
            <ul className="space-y-2.5">
              {recent.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-app text-xs font-semibold tabular-nums">
                    {b.start.slice(0, 5)}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-medium">{b.courtName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {b.customerName}
                    </span>
                  </span>
                  <StatusBadge status={toBookingStatus(b.status)} />
                </li>
              ))}
            </ul>
          )}
        </CardShell>
      </div>

      {/* Row: channels + sport donut + action items */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Booking channels */}
        <CardShell title="ช่องทางการจอง">
          {channels.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีข้อมูล</p>
          ) : (
            <ul className="space-y-3">
              {channels.map((c) => {
                const pct = Math.round((c.count / channelTotal) * 100);
                return (
                  <li key={c.channel}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{channelLabel(c.channel)}</span>
                      <span className="font-semibold">
                        {fmt.format(c.count)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-app">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${Math.max(4, (c.count / channelMax) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardShell>

        {/* Sport sales donut */}
        <CardShell title="ยอดขายตามประเภทกีฬา">
          {sports.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีข้อมูล</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sports}
                      dataKey="revenue"
                      nameKey="sport"
                      innerRadius={48}
                      outerRadius={66}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {sports.map((s, i) => (
                        <Cell key={s.sport} fill={SPORT_COLORS[i % SPORT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [`฿${fmt.format(Number(v))}`, sportLabel(n as string)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-bold">฿{fmt.format(sportTotal)}</span>
                  <span className="text-[11px] text-muted-foreground">รวม</span>
                </div>
              </div>
              <ul className="flex-1 space-y-2 text-sm">
                {sports.map((s, i) => (
                  <li key={s.sport} className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: SPORT_COLORS[i % SPORT_COLORS.length] }}
                    />
                    <span className="flex-1 text-muted-foreground">{sportLabel(s.sport)}</span>
                    <span className="font-semibold">฿{fmt.format(s.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardShell>

        {/* Action items */}
        <CardShell title="รายการที่ต้องดำเนินการ">
          <ul className="space-y-2">
            {actions.map((a) => {
              const inner = (
                <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-app">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${a.tint}`}>
                    <a.icon className="size-5" />
                  </span>
                  <span className="flex-1 text-sm">{a.label}</span>
                  <span className="min-w-6 rounded-full bg-app px-2 py-0.5 text-center text-sm font-bold">
                    {fmt.format(a.count)}
                  </span>
                </div>
              );
              return (
                <li key={a.label}>
                  {a.href ? (
                    <Link href={a.href} className="block">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </CardShell>
      </div>

      {/* Recent bookings */}
      <CardShell
        title="การจองล่าสุด"
        action={
          <Link href="/owner/bookings" className="text-xs font-medium text-brand">
            ดูทั้งหมด
          </Link>
        }
      >
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีรายการจอง</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {recent.map((b) => (
                <div key={b.id} className="rounded-xl bg-app p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{b.customerName}</span>
                    <StatusBadge status={toBookingStatus(b.status)} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{b.courtName}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {b.start.slice(0, 5)}–{b.end.slice(0, 5)}
                    </span>
                    <span className="font-semibold text-brand">฿{fmt.format(b.amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-medium text-muted-foreground">
                  <tr className="border-b border-black/5">
                    <th className="px-3 py-2">เวลา</th>
                    <th className="px-3 py-2">ลูกค้า</th>
                    <th className="px-3 py-2">สนาม</th>
                    <th className="px-3 py-2 text-right">ยอดเงิน</th>
                    <th className="px-3 py-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {recent.map((b) => (
                    <tr key={b.id} className="hover:bg-app/60">
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {b.start.slice(0, 5)}–{b.end.slice(0, 5)}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{b.customerName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{b.courtName}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-brand">
                        ฿{fmt.format(b.amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={toBookingStatus(b.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardShell>
    </div>
  );
}

/**
 * The floor, right now.
 *
 * The question staff ask standing at the counter — which courts have someone on
 * them, how much longer, who is next — used to need reading the day's booking
 * list and doing the arithmetic. It sits above the charts because it is about
 * the next ten minutes, and everything below it is about the last seven days.
 *
 * Refreshes itself: a board that is right only when you reload is a board
 * nobody trusts. The clock it is reading is printed in the header, because the
 * server runs on UTC and the venue does not.
 */
function CourtBoardPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "courts", "live"],
    queryFn: ownerApi.getCourtBoard,
    // Half a minute: a court's remaining time is shown in whole minutes, so
    // anything slower would visibly lag the wall clock.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <Loading rows={2} />;
  if (!data || data.branches.length === 0) return null;

  const courts = data.branches.flatMap((b) => b.courts);
  const playing = courts.filter((c) => c.status === "playing").length;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          สถานะสด
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            กำลังเล่น {playing} / {courts.length} คอร์ท
          </span>
        </h2>
        <span className="text-xs text-muted-foreground">
          เวลาสนาม {data.now} น. · อัปเดตทุก 30 วินาที
        </span>
      </div>

      <div className="space-y-4">
        {data.branches.map((branch) => (
          <div key={branch.id}>
            {/* Only worth naming when there is more than one place to be. */}
            {data.branches.length > 1 && (
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{branch.name ?? "—"}</h3>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {branch.courts.map((court) => (
                <CourtTile key={court.id} court={court} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CourtTile({ court }: { court: CourtBoard["branches"][number]["courts"][number] }) {
  const playing = court.status === "playing";
  // Booked but nobody scanned in: the one the desk should walk over and check.
  const unchecked = playing && !court.current?.checkedIn;

  return (
    <div
      className={`rounded-xl p-3 ring-1 ${
        playing ? "bg-brand/5 ring-brand/20" : "bg-app ring-black/5"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">{court.name}</span>
        {playing ? (
          <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
            เหลือ {court.current!.minutesLeft} น.
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">ว่าง</span>
        )}
      </div>

      {court.current ? (
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {court.current.customerName ?? "—"} · {court.current.start}–{court.current.end}
          {unchecked && <span className="text-brand-warning"> · ยังไม่เช็คอิน</span>}
        </div>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">ไม่มีใครใช้อยู่</div>
      )}

      {/* The queue. On a free court this is what stops staff selling an hour
          that is already sold. */}
      {court.next ? (
        <div className="mt-2 border-t border-black/5 pt-2 text-[11px] text-muted-foreground">
          คิวถัดไป {court.next.start} · {court.next.customerName ?? "—"}
          <span className="text-foreground"> (อีก {court.next.minutesUntil} น.)</span>
        </div>
      ) : (
        <div className="mt-2 border-t border-black/5 pt-2 text-[11px] text-muted-foreground">
          ไม่มีคิวถัดไป
        </div>
      )}
    </div>
  );
}
