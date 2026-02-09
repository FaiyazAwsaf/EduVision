"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  ClipboardCheck,
  Lightbulb,
  BookOpen,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  {
    label: "Class Overview",
    href: "/teacher/dashboard",
    icon: LayoutDashboard,
  },
  { label: "Students", href: "/teacher/students", icon: Users },
  { label: "Script Engine", href: "/evaluation", icon: ScrollText },
  { label: "Content Generation", href: "/content", icon: FileText },
  { label: "Rubrics", href: "/rubrics", icon: ClipboardCheck },
  { label: "Insights", href: "/teacher/insights", icon: Lightbulb },
];

export default function TeacherSidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  // Get user initials
  const initials = user
    ? `${user.first_name[0] || ""}${user.last_name[0] || ""}`
    : "U";
  const fullName = user
    ? `${user.first_name} ${user.last_name}`
    : "User";

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-[#9ACBD0]/40 flex flex-col z-30">
      {/* Brand */}
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-[#48A6A7] rounded-xl flex items-center justify-center shadow-md">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#006A71] leading-tight">
            EduVision
          </h1>
          <p className="text-[11px] text-[#48A6A7] font-medium">
            Teacher Portal
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#48A6A7]/10 text-[#006A71] border-l-[3px] border-[#48A6A7] pl-[9px]"
                  : "text-[#6B7280] hover:bg-[#F2EFE7] hover:text-[#006A71]"
              }`}
            >
              <item.icon
                className={`w-[18px] h-[18px] ${
                  isActive ? "text-[#48A6A7]" : ""
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 mt-auto space-y-1">
        <Link
          href="/teacher/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F2EFE7] hover:text-[#006A71] transition-all"
        >
          <Settings className="w-[18px] h-[18px]" />
          Settings
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Log Out
        </button>

        {/* User pill */}
        <div className="mt-3 flex items-center gap-3 bg-[#F2EFE7] rounded-xl px-3 py-3">
          <div className="w-9 h-9 rounded-full bg-[#006A71] flex items-center justify-center text-white font-semibold text-sm shadow-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#006A71] truncate">
              {fullName}
            </p>
            <p className="text-[11px] text-[#48A6A7]">Teacher</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
