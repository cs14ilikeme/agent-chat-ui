"use client";

import * as React from "react";
import { AuthProvider } from "@/lib/auth-context";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
