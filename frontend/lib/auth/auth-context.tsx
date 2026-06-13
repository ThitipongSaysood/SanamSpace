"use client";
import { createContext, useContext, useState } from "react";
import type { User } from "@/lib/types";
import { api } from "@/lib/api/client";
import { clearToken } from "@/lib/api/token";

const STORAGE_KEY = "sanamspace.profile";

// Demo identity sent to the (stubbed) LINE login so the same customer is resolved each time.
const LINE_PAYLOAD = {
  lineUserId: "Uxxxx",
  displayName: "คุณสมชาย",
  email: "example@email.com",
  phone: "081-234-5678",
};

function loadOverrides(): Partial<User> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Partial<User>;
  } catch {
    return {};
  }
}

type AuthValue = {
  user: User | null;
  login: () => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
};
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  async function login() {
    const { user: authed } = await api.lineLogin(LINE_PAYLOAD);
    // Apply any locally-saved profile edits on top (backend has no customer-update endpoint yet).
    setUser({ ...authed, ...loadOverrides() });
  }
  function logout() {
    clearToken();
    setUser(null);
  }
  function updateUser(patch: Partial<User>) {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadOverrides(), ...patch }));
      } catch {
        /* ignore */
      }
    }
  }

  return <Ctx.Provider value={{ user, login, logout, updateUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
