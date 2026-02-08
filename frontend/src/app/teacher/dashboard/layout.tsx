"use client";

import React from "react";
import TeacherSidebar from "@/components/shared/TeacherSidebar";

export default function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F2EFE7]">
      <TeacherSidebar />
      <div className="ml-60">{children}</div>
    </div>
  );
}
