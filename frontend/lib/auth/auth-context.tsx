"use client";
import { createContext, useContext, useState } from "react";
import type { User } from "@/lib/types";

const MOCK_USER: User = { id: "u1", displayName: "คุณสมชาย", lineId: "Uxxxx" };

type AuthValue = { user: User | null; login: () => void; logout: () => void };
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  return <Ctx.Provider value={{ user, login: () => setUser(MOCK_USER), logout: () => setUser(null) }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
