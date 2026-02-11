"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  ClipboardCheck,
  Lightbulb,
  FileText,
  MessageSquare,
  BarChart3,
  Settings,
  BookOpen,
  LogOut,
  History,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const teacherNavItems: NavItem[] = [
  {
    label: "Class Overview",
    href: "/teacher/dashboard",
    icon: LayoutDashboard,
  },
  { label: "Students", href: "/teacher/students", icon: Users },
  { label: "Script Engine", href: "/evaluation", icon: ScrollText },
  { label: "Content Generation", href: "/content", icon: FileText },
  { label: "Content History", href: "/content/history", icon: History },
  { label: "Rubrics", href: "/rubrics", icon: ClipboardCheck },
  { label: "Insights", href: "/teacher/insights", icon: Lightbulb },
];

const studentNavItems: NavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Content Request", href: "/content", icon: FileText },
  { label: "My Content", href: "/content/history", icon: History },
  { label: "Tutoring", href: "/student/tutoring", icon: MessageSquare },
  { label: "Scripts", href: "/evaluation", icon: ScrollText },
  { label: "Analytics", href: "/student/analytics", icon: BarChart3 },
];

const roleConfig = {
  teacher: {
    navItems: teacherNavItems,
    portalLabel: "Teacher Portal",
    settingsHref: "/teacher/settings",
    roleLabel: "Teacher",
  },
  student: {
    navItems: studentNavItems,
    portalLabel: "Student Portal",
    settingsHref: "/student/settings",
    roleLabel: "Student",
  },
} as const;

interface SidebarProps {
  role: "teacher" | "student";
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const config = roleConfig[role];

  const initials = user
    ? `${user.first_name[0] || ""}${user.last_name[0] || ""}`
    : "U";
  const fullName = user ? `${user.first_name} ${user.last_name}` : "User";

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-secondary/40 flex flex-col z-30">
      {/* Brand */}
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-primary-dark leading-tight">
            EduVision
          </h1>
          <p className="text-[11px] text-primary font-medium">
            {config.portalLabel}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-2 space-y-1">
        {config.navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary-dark border-l-[3px] border-primary pl-[9px]"
                  : "text-muted hover:bg-background hover:text-primary-dark"
              }`}
            >
              <item.icon
                className={`w-[18px] h-[18px] ${
                  isActive ? "text-primary" : ""
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
          href={config.settingsHref}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-background hover:text-primary-dark transition-all"
        >
          <Settings className="w-[18px] h-[18px]" />
          Settings
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Log Out
        </button>

        {/* User pill */}
        <Link
          href={role === "student" ? "/student/profile" : "/teacher/profile"}
          className="mt-3 flex items-center gap-3 bg-background rounded-xl px-3 py-3 hover:bg-primary/5 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-primary-dark flex items-center justify-center text-white font-semibold text-sm shadow-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary-dark truncate">
              {fullName}
            </p>
            <p className="text-[11px] text-primary">{config.roleLabel}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
