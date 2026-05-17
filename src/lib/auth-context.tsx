"use client";

import * as React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Role = "admin" | "worker" | "viewer" | "unknown";

interface AuthState {
  username: string | null;
  role: Role;
  authenticated: boolean;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Check if current role has given permission */
  can: (permission: "read" | "worker" | "admin") => boolean;
}

const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  admin: new Set(["read", "worker", "admin"]),
  worker: new Set(["read", "worker"]),
  viewer: new Set(["read"]),
  unknown: new Set([]),
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    username: null,
    role: "unknown",
    authenticated: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setState({
          username: data.user.username,
          role: data.user.role || "admin",
          authenticated: true,
          loading: false,
        });
      } else {
        setState({
          username: null,
          role: "unknown",
          authenticated: false,
          loading: false,
        });
      }
    } catch {
      setState({
        username: null,
        role: "unknown",
        authenticated: false,
        loading: false,
      });
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    setState({ username: null, role: "unknown", authenticated: false, loading: false });
    window.location.href = "/login";
  }, []);

  const can = useCallback(
    (permission: "read" | "worker" | "admin") => {
      return ROLE_PERMISSIONS[state.role]?.has(permission) ?? false;
    },
    [state.role]
  );

  return (
    <AuthContext.Provider value={{ ...state, logout, refresh, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
