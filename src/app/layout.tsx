import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ClientProviders } from "@/components/client-providers";

const inter = Inter({
  subsets: ["latin"],
  preload: true,
  display: "swap",
});

export const metadata: Metadata = {
  title: "GA-Claw Workbench",
  description: "GA-Claw 协作工作台 for rooms, approvals, workspaces and artifacts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientProviders>
          <NuqsAdapter>{children}</NuqsAdapter>
        </ClientProviders>
      </body>
    </html>
  );
}
