"use client";

import React from "react";
import StudentSidebar from "@/components/shared/StudentSidebar";

export default function StudentTutoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F2EFE7]">
      <StudentSidebar />
      <div className="ml-60">{children}</div>
    </div>
  );
}
