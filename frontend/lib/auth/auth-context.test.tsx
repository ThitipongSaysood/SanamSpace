import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./auth-context";

function Probe() {
  const { user, login } = useAuth();
  return <div><span>{user ? user.displayName : "guest"}</span><button onClick={login}>login</button></div>;
}

describe("auth", () => {
  it("starts as guest then logs in to a mock user", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("guest")).toBeInTheDocument();
    await userEvent.click(screen.getByText("login"));
    expect(await screen.findByText("คุณสมชาย")).toBeInTheDocument();
  });
});
