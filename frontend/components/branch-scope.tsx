"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ownerApi } from "@/lib/api/owner";
import type { OwnerBranch } from "@/lib/types";

/**
 * Which branch the owner is looking at.
 *
 * The portal was organization-scoped from end to end: a venue with three
 * branches saw one dashboard covering all three and one calendar with every
 * branch's courts side by side, and no way to ask about a single branch. The
 * header switcher writes here; the screens that are branch-aware read `branchId`
 * and pass it to the API, which resolves it against the venue's OWN branches.
 *
 * `null` is ทุกสาขา, and it is the default. A single-branch venue therefore
 * never sees a switcher and never sends the parameter — the combined view is
 * the same request the portal has always made.
 */
const STORAGE_KEY = "sanamspace.owner_branch";

type BranchScope = {
  /** null = every branch. */
  branchId: string | null;
  setBranchId: (id: string | null) => void;
  branches: OwnerBranch[];
  /** The selected branch, or null while on ทุกสาขา. */
  branch: OwnerBranch | null;
  /** A switcher is only worth showing to a venue that has somewhere to switch to. */
  multiBranch: boolean;
};

const Ctx = createContext<BranchScope>({
  branchId: null,
  setBranchId: () => {},
  branches: [],
  branch: null,
  multiBranch: false,
});

export function BranchScopeProvider({ children }: { children: React.ReactNode }) {
  const [branchId, setBranchIdState] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["owner", "branches"], queryFn: ownerApi.getBranches });
  const branches = useMemo(() => data ?? [], [data]);

  // Restored after mount rather than in the initial state, so the server and
  // the first client render agree.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBranchIdState(saved);
    } catch {
      /* storage blocked — the scope simply won't persist */
    }
  }, []);

  // A branch that has been closed, deleted, or belongs to an account the user
  // has since been removed from would otherwise 404 every request on every
  // screen, with a switcher showing a branch that is not in the list.
  useEffect(() => {
    if (!branchId || branches.length === 0) return;
    if (!branches.some((b) => b.id === branchId)) setBranchIdState(null);
  }, [branchId, branches]);

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<BranchScope>(
    () => ({
      branchId,
      setBranchId,
      branches,
      branch: branches.find((b) => b.id === branchId) ?? null,
      multiBranch: branches.length > 1,
    }),
    [branchId, setBranchId, branches],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBranchScope() {
  return useContext(Ctx);
}
