import { redirect } from "next/navigation";

/**
 * The platform root is not a venue.
 *
 * Every customer screen belongs to exactly one venue and lives under
 * /v/{slug}; there is deliberately no cross-venue landing page for customers,
 * so the bare root goes to the marketing site instead.
 */
export default function RootPage() {
  redirect("/landing");
}
