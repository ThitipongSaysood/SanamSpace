"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ChevronDown } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useVenues } from "@/lib/api/queries";
import { useTenant } from "@/lib/tenant/tenant-context";
import { useMessages } from "@/lib/i18n/context";
import { fmt } from "@/lib/i18n/format";
import { VenueCard } from "@/components/venue-card";
import { Loading, EmptyState, ErrorState } from "@/components/states";

const selectCls =
  "h-11 w-full appearance-none rounded-xl bg-white px-3.5 pr-9 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <span className="relative block">
        {children}
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

function SearchInner() {
  // The venue's own sports, not a list of four written into the app. The filter
  // used to offer แบดมินตัน/ฟุตบอล/ฟุตซอล/เทนนิส to every venue on the
  // platform, so most of its options searched for something nobody rented.
  const { tenant } = useTenant();
  const t = useMessages("app").search;
  const sportParam = useSearchParams().get("sport");
  const initialSport = tenant.sportMeta.some((s) => s.key === sportParam) ? (sportParam as string) : "";

  const [keyword, setKeyword] = useState("");
  const [sport, setSport] = useState<string>(initialSport);
  const [location, setLocation] = useState("all");
  const [date, setDate] = useState("25 มิ.ย. 2569");
  const [time, setTime] = useState("16:00 - 20:00");
  const [searched, setSearched] = useState(false);

  const { data: venues, isLoading, isError, refetch } = useVenues();

  const results = (venues ?? []).filter((v) => {
    const matchKeyword =
      keyword.trim() === "" || v.name.toLowerCase().includes(keyword.trim().toLowerCase());
    const matchSport = sport === "" || (v.sports as string[]).includes(sport);
    return matchKeyword && matchSport;
  });

  return (
    <main className="pb-8">
      <AppHeader title={t.title} />
      <div className="space-y-5 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearched(true);
          }}
          className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t.keywordPlaceholder}
              className="h-11 w-full rounded-xl bg-white pl-10 pr-3.5 text-sm ring-1 ring-black/10 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <Field label={t.sportType}>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className={selectCls}
            >
              <option value="">{t.allTypes}</option>
              {tenant.sportMeta.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.location}>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={selectCls}
            >
              <option value="all">{t.all}</option>
              <option value="nonthaburi">นนทบุรี</option>
              <option value="pathumthani">ปทุมธานี</option>
            </select>
          </Field>

          <Field label={t.date}>
            <select value={date} onChange={(e) => setDate(e.target.value)} className={selectCls}>
              <option>25 มิ.ย. 2569</option>
              <option>26 มิ.ย. 2569</option>
              <option>27 มิ.ย. 2569</option>
            </select>
          </Field>

          <Field label={t.time}>
            <select value={time} onChange={(e) => setTime(e.target.value)} className={selectCls}>
              <option>10:00 - 12:00</option>
              <option>12:00 - 16:00</option>
              <option>16:00 - 20:00</option>
              <option>20:00 - 22:00</option>
            </select>
          </Field>

          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground transition active:scale-[0.99]"
          >
            {t.searchBtn}
          </button>
        </form>

        {searched && (
          <section aria-label={t.resultsAria}>
            {isLoading && <Loading />}
            {isError && <ErrorState onRetry={() => refetch()} />}
            {!isLoading && !isError && (
              <>
                <h2 className="mb-2 font-semibold">{fmt(t.foundN, { n: results.length })}</h2>
                {results.length === 0 ? (
                  <EmptyState message={t.notFound} />
                ) : (
                  <div className="space-y-3">
                    {results.map((v) => (
                      <VenueCard key={v.id} venue={v} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SearchInner />
    </Suspense>
  );
}
