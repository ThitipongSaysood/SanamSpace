"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import type { DuplicateGroup, OwnerCustomer } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { appendPage } from "@/lib/api/paged";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { LoadMore } from "@/components/load-more";
import { Button } from "@/components/ui/button";

const fmt = new Intl.NumberFormat("th-TH");

export default function OwnerCustomersPage() {
  // A venue's customer list only grows, so it arrives a page at a time and the
  // screen keeps what it has already shown.
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OwnerCustomer[]>([]);

  const { data: pageData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["owner", "customers", page],
    queryFn: async () => {
      const res = await ownerApi.getCustomersPage(page);
      setRows((prev) => (page === 1 ? res.items : appendPage(prev, res.items)));
      return res;
    },
    placeholderData: keepPreviousData,
  });

  const data = rows;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">ลูกค้า</h1>
        <p className="text-sm text-muted-foreground">จัดการข้อมูลลูกค้า</p>
      </header>

      <Duplicates />

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีลูกค้า" />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((c) => (
            <Link
              key={c.id}
              href={`/owner/customers/${c.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:ring-brand/30 active:scale-[0.99] sm:flex sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-semibold">{c.displayName}</div>
                {c.phone && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5" />
                    {c.phone}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-5 sm:mt-0 sm:text-right">
                <div>
                  <div className="text-base font-bold text-brand">฿{fmt.format(c.totalSpending)}</div>
                  <div className="text-xs text-muted-foreground">ยอดใช้จ่าย</div>
                </div>
                <div>
                  <div className="text-base font-bold">{fmt.format(c.visits)}</div>
                  <div className="text-xs text-muted-foreground">เข้าใช้</div>
                </div>
                <div>
                  <div className="text-base font-bold">{fmt.format(c.bookingsCount)}</div>
                  <div className="text-xs text-muted-foreground">การจอง</div>
                </div>
                {/* Only for customers who actually hold something — a column of
                    "0 ชม." on every row is noise, and what staff scan for here
                    is who has a balance with the venue. */}
                {(c.creditBalance ?? 0) > 0 && (
                  <div>
                    <div className="text-base font-bold text-brand">฿{fmt.format(c.creditBalance!)}</div>
                    <div className="text-xs text-muted-foreground">เครดิต</div>
                  </div>
                )}
                {(c.creditHours ?? 0) > 0 && (
                  <div>
                    <div className="text-base font-bold">{fmt.format(c.creditHours!)} ชม.</div>
                    <div className="text-xs text-muted-foreground">ชั่วโมงคงเหลือ</div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {data.length > 0 && (
        <LoadMore
          shown={data.length}
          total={pageData?.total ?? data.length}
          hasMore={pageData?.hasMore ?? false}
          loading={isFetching}
          onMore={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  );
}

/**
 * People who are in the list twice.
 *
 * Made at the counter: the same regular booked as a walk-in each visit, or a
 * cash customer who later signed in with LINE. Each row holds part of what they
 * are owed, so the customer can see none of it in one place — and the venue
 * cannot honour points that are split across records it does not know are the
 * same person.
 *
 * Absent when there are none. This is a problem to fix, not a permanent panel.
 */
function Duplicates() {
  const qc = useQueryClient();
  const [merging, setMerging] = useState<{ group: DuplicateGroup; keepId: string } | null>(null);

  const { data } = useQuery({ queryKey: DUPLICATES_KEY, queryFn: ownerApi.getDuplicateCustomers });

  const merge = useMutation({
    mutationFn: ({ keepId, duplicateId }: { keepId: string; duplicateId: string }) =>
      ownerApi.mergeCustomers(keepId, duplicateId),
    onSuccess: () => {
      setMerging(null);
      qc.invalidateQueries({ queryKey: DUPLICATES_KEY });
      qc.invalidateQueries({ queryKey: ["owner", "customers"] });
    },
  });

  const groups = data ?? [];
  if (groups.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <div>
        <h2 className="text-sm font-semibold text-amber-900">ลูกค้าซ้ำ {groups.length} เบอร์</h2>
        <p className="text-xs text-amber-800">
          เบอร์เดียวกันแต่มีหลายใบ · แต้มกับเครดิตกระจายกันอยู่ · รวมแล้วทุกอย่างจะย้ายมาอยู่ใบเดียว
        </p>
      </div>

      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.phone} className="rounded-xl bg-white p-3 ring-1 ring-black/5">
            <div className="mb-2 font-mono text-xs text-muted-foreground">{g.phone}</div>
            <ul className="divide-y divide-black/5">
              {g.customers.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {c.displayName}
                      {c.hasLine && (
                        <span className="ml-1.5 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                          LINE
                        </span>
                      )}
                    </div>
                    {/* What would move, shown before the choice is made. */}
                    <div className="text-xs text-muted-foreground">
                      จอง {fmt.format(c.bookingsCount)} ครั้ง · {fmt.format(c.points)} แต้ม · เครดิต ฿
                      {fmt.format(c.credit)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMerging({ group: g, keepId: c.id })}
                    className="shrink-0 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium hover:bg-app"
                  >
                    เก็บใบนี้ รวมที่เหลือเข้ามา
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {merging && (
        <ConfirmMerge
          group={merging.group}
          keepId={merging.keepId}
          pending={merge.isPending}
          error={merge.isError ? (merge.error as Error).message : null}
          onCancel={() => setMerging(null)}
          onConfirm={(duplicateId) => merge.mutate({ keepId: merging.keepId, duplicateId })}
        />
      )}
    </section>
  );
}

/**
 * The last look before two records become one.
 *
 * Spelled out rather than a yes/no: a merge moves money and points, and the
 * only way back is by hand. Merging happens one duplicate at a time so what
 * moved is always traceable to a single decision.
 */
function ConfirmMerge({
  group,
  keepId,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  group: DuplicateGroup;
  keepId: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (duplicateId: string) => void;
}) {
  const keep = group.customers.find((c) => c.id === keepId)!;
  const others = group.customers.filter((c) => c.id !== keepId);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="ยืนยันการรวมลูกค้า">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="font-semibold">รวมลูกค้าซ้ำ</h3>

        <div className="rounded-xl bg-app p-3 text-sm">
          <div className="text-xs text-muted-foreground">ใบที่เก็บไว้</div>
          <div className="font-semibold">{keep.displayName}</div>
          <div className="text-xs text-muted-foreground">
            {fmt.format(keep.points)} แต้ม · เครดิต ฿{fmt.format(keep.credit)}
          </div>
        </div>

        <ul className="space-y-2">
          {others.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/10 p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{c.displayName}</div>
                <div className="text-xs text-muted-foreground">
                  ย้ายมา: จอง {fmt.format(c.bookingsCount)} ครั้ง · {fmt.format(c.points)} แต้ม · ฿
                  {fmt.format(c.credit)}
                </div>
              </div>
              <Button type="button" size="sm" disabled={pending} onClick={() => onConfirm(c.id)}>
                {pending ? "กำลังรวม…" : "รวมเข้าใบที่เก็บ"}
              </Button>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          ใบที่ถูกรวมจะถูกซ่อน แต่ยังเก็บไว้ในระบบ · แต้มและเครดิตจะบวกเข้าด้วยกัน ไม่มีอะไรหาย
        </p>

        {error && <p className="text-sm text-brand-danger">{error}</p>}

        <Button type="button" variant="outline" className="w-full" onClick={onCancel} disabled={pending}>
          ปิด
        </Button>
      </div>
    </div>
  );
}

const DUPLICATES_KEY = ["owner", "customers", "duplicates"];

