import { redirect } from "next/navigation";

/**
 * Coupons moved in with promotions — the two halves of one thing.
 *
 * Kept as a redirect rather than deleted: this path is in the sidebar's history
 * for anyone who bookmarked it, and it is still linked from the promotion form.
 * A 404 on a page that existed yesterday reads as the feature being gone.
 */
export default function OwnerCouponsRedirect() {
  redirect("/owner/promotions");
}
