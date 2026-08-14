import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./auth-context";
import { api } from "../api/client";
import { setToken, clearToken } from "../api/token";

function Probe() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span>{user ? user.displayName : "guest"}</span>
      <button onClick={() => login()}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe("auth", () => {
  beforeEach(() => clearToken());

  it("starts as guest then logs in to a mock user", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("guest")).toBeInTheDocument();
    await userEvent.click(screen.getByText("login"));
    expect(await screen.findByText("คุณสมชาย")).toBeInTheDocument();
  });

  it("restores the session on mount when a token is stored (refresh stays logged in)", async () => {
    setToken("existing-token");
    render(<AuthProvider><Probe /></AuthProvider>);
    // No login click — the provider rehydrates the user via api.me().
    expect(await screen.findByText("คุณสมชาย")).toBeInTheDocument();
  });

  it("logs out to guest and revokes the token server-side", async () => {
    const spy = vi.spyOn(api, "logout");
    render(<AuthProvider><Probe /></AuthProvider>);

    await userEvent.click(screen.getByText("login"));
    expect(await screen.findByText("คุณสมชาย")).toBeInTheDocument();

    await userEvent.click(screen.getByText("logout"));
    expect(await screen.findByText("guest")).toBeInTheDocument();
    // The server-side revoke was attempted, not just a local clear — otherwise
    // the Sanctum token would live on after the customer signed out.
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
