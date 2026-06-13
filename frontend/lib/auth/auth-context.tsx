"use client";
import { createContext, useContext, useState } from "react";
import type { User } from "@/lib/types";

const STORAGE_KEY = "sanamspace.profile";
const BASE_USER: User = {
  id: "u1",
  displayName: "คุณสมชาย",
  lineId: "Uxxxx",
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
  login: () => void;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
};
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  function login() {
    setUser({ ...BASE_USER, ...loadOverrides() });
  }
  function logout() {
    setUser(null);
  }
  function updateUser(patch: Partial<User>) {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadOverrides(), ...patch }));
      } catch {
        /* ignore quota/serialization errors in this mock */
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
