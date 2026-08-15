import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BranchScopeProvider, useBranchScope } from "@/components/branch-scope";
import { ownerApi } from "@/lib/api/owner";
import type { OwnerBranch } from "@/lib/types";

/**
 * The scope every branch-aware owner screen reads.
 *
 * What matters here is not the switcher's looks but its two promises: that the
 * choice survives moving between screens, and that a venue with one branch is
 * never asked to make one.
 */
function branch(id: string, name: string): OwnerBranch {
  return {
    id, name, status: "active", sports: ["badminton"], facilities: [], photos: [], courtCount: 2,
  } as OwnerBranch;
}

function Probe() {
  const { branchId, setBranchId, multiBranch, branch: selected } = useBranchScope();

  return (
    <div>
      <span data-testid="scope">{branchId ?? "all"}</span>
      <span data-testid="name">{selected?.name ?? "—"}</span>
      <span data-testid="multi">{String(multiBranch)}</span>
      <button type="button" onClick={() => setBranchId("b2")}>
        pick b2
      </button>
      <button type="button" onClick={() => setBranchId(null)}>
        pick all
      </button>
    </div>
  );
}

function renderScope() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={qc}>
      <BranchScopeProvider>
        <Probe />
      </BranchScopeProvider>
    </QueryClientProvider>,
  );
}

describe("the owner's branch scope", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts on every branch — the combined view is the default", async () => {
    vi.spyOn(ownerApi, "getBranches").mockResolvedValue([branch("b1", "สาขาหลัก"), branch("b2", "รังสิต")]);
    renderScope();

    expect(screen.getByTestId("scope")).toHaveTextContent("all");
    await waitFor(() => expect(screen.getByTestId("multi")).toHaveTextContent("true"));
  });

  it("remembers the branch across screens", async () => {
    vi.spyOn(ownerApi, "getBranches").mockResolvedValue([branch("b1", "สาขาหลัก"), branch("b2", "รังสิต")]);
    renderScope();

    await userEvent.click(screen.getByRole("button", { name: "pick b2" }));

    expect(screen.getByTestId("scope")).toHaveTextContent("b2");
    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("รังสิต"));
    // Persisted, because the scope has to survive a navigation to be useful.
    expect(window.localStorage.getItem("sanamspace.owner_branch")).toBe("b2");
  });

  it("clears the stored branch when the owner goes back to every branch", async () => {
    vi.spyOn(ownerApi, "getBranches").mockResolvedValue([branch("b1", "สาขาหลัก"), branch("b2", "รังสิต")]);
    renderScope();

    await userEvent.click(screen.getByRole("button", { name: "pick b2" }));
    await userEvent.click(screen.getByRole("button", { name: "pick all" }));

    expect(screen.getByTestId("scope")).toHaveTextContent("all");
    expect(window.localStorage.getItem("sanamspace.owner_branch")).toBeNull();
  });

  /**
   * A stored branch that no longer exists would 404 every request on every
   * screen, under a switcher naming a branch that is not in its own list.
   */
  it("falls back to every branch when the stored one is gone", async () => {
    window.localStorage.setItem("sanamspace.owner_branch", "deleted-branch");
    vi.spyOn(ownerApi, "getBranches").mockResolvedValue([branch("b1", "สาขาหลัก"), branch("b2", "รังสิต")]);

    renderScope();

    await waitFor(() => expect(screen.getByTestId("scope")).toHaveTextContent("all"));
  });

  it("tells a single-branch venue there is nothing to switch between", async () => {
    vi.spyOn(ownerApi, "getBranches").mockResolvedValue([branch("b1", "สาขาเดียว")]);
    renderScope();

    await waitFor(() => expect(screen.getByTestId("multi")).toHaveTextContent("false"));
  });
});
