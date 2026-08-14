// The marketing pricing cards read from here, so the plan a prospective venue
// sees is the same one the admin Feature Matrix defines — no tenant, no token,
// no venue slug. Kept out of `http.ts` (whose `req()` stamps X-Venue-Slug and
// handles 401 redirects) because none of that applies before you have an account.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export type PublicPlan = {
  code: string;
  name: string;
  price: number;
  interval: string;
  limits: {
    branchLimit: number | null;
    courtLimit: number | null;
    staffLimit: number | null;
    monthlyBookingLimit: number | null;
    storageGb: number | null;
  };
  /** Codes of the features this plan currently enables (pivot.enabled = 1). */
  featureCodes: string[];
};

/** GET /plans — active plans, cheapest first. Throws on a non-2xx response. */
export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const res = await fetch(`${BASE}/plans`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET /plans -> ${res.status}`);
  const json = await res.json();
  // Laravel resource collections wrap in { data: [...] }.
  return (json && typeof json === "object" && "data" in json ? json.data : json) as PublicPlan[];
}
