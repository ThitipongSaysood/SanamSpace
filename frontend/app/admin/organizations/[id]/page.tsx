"use client";
import { use } from "react";
import { OrgDetail } from "../_detail";

/**
 * One venue's own page, reached from the list.
 *
 * It used to be a drawer beside the table, which meant an admin edited a
 * venue's sports and its four LINE credentials through a 380px slot while the
 * table it was docked to lost the columns on its right. A venue is a subject in
 * its own right, so it gets a URL — which also means an admin can send a
 * colleague a link to the venue they are talking about.
 */
export default function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <OrgDetail id={id} />;
}
