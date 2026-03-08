"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/shared/Sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isReady, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && (!isAuthenticated || !user || user.role !== "admin")) {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="admin" />
      <main className="ml-60 p-6">{children}</main>
    </div>
  );
}
