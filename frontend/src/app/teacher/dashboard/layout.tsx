"use client";

import React from "react";
import Sidebar from "@/components/shared/Sidebar";

export default function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="teacher" />
      <div className="ml-60">{children}</div>
    </div>
  );
}
