"use client";

import React, { useState, useEffect } from "react";
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
  ChevronDown,
  ChevronUp,
  LibraryBig,
  KeyRound,
  GraduationCap,
  School,
  Layers,
  UserCog,
  ShieldCheck,
  Brain,
  PenTool,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const teacherNavItems: NavEntry[] = [
  {
    label: "Class Overview",
    href: "/teacher/dashboard",
    icon: LayoutDashboard,
  },
  { label: "Students", href: "/teacher/students", icon: Users },
  {
    label: "Evaluation",
    icon: ScrollText,
    children: [
      { label: "Script Evaluation", href: "/evaluation", icon: ClipboardCheck },
      { label: "Rubrics", href: "/rubrics", icon: FileText },
    ],
  },
  {
    label: "Content",
    icon: LibraryBig,
    children: [
      { label: "Content Generation", href: "/content", icon: FileText },
      { label: "Content History", href: "/content/history", icon: History },
    ],
  },
  { label: "Insights", href: "/teacher/insights", icon: Lightbulb },
  { label: "Smart Analytics", href: "/teacher/analytics", icon: BarChart3 },
  { label: "Class Intelligence", href: "/teacher/intelligence", icon: Brain },
  { label: "Whiteboard", href: "/whiteboard", icon: PenTool },
];
const studentNavItems: NavEntry[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  {
    label: "Content",
    icon: LibraryBig,
    children: [
      { label: "Content Request", href: "/content", icon: FileText },
      { label: "My Content", href: "/content/history", icon: History },
      { label: "Class Materials", href: "/content/shared", icon: BookOpen },
    ],
  },
  { label: "Tutoring", href: "/student/tutoring", icon: MessageSquare },
  { label: "Practice", href: "/student/practice", icon: BookOpen },
  { label: "Scripts", href: "/student/scripts", icon: ScrollText },
  { label: "Analytics", href: "/student/analytics", icon: BarChart3 },
  { label: "My Insights", href: "/student/insights", icon: Brain },
  { label: "Whiteboard", href: "/whiteboard", icon: PenTool },
];


const adminNavItems: NavEntry[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Users",
    icon: Users,
    children: [
      { label: "All Users", href: "/admin/users", icon: UserCog },
      {
        label: "Teachers",
        href: "/admin/users?role=teacher",
        icon: GraduationCap,
      },
      { label: "Students", href: "/admin/users?role=student", icon: Users },
    ],
  },
  {
    label: "School",
    icon: School,
    children: [
      { label: "Classes", href: "/admin/classes", icon: Layers },
      { label: "Sections", href: "/admin/sections", icon: School },
    ],
  },
  {
    label: "Academics",
    icon: BookOpen,
    children: [
      { label: "Subjects", href: "/admin/subjects", icon: BookOpen },
      {
        label: "Assignments",
        href: "/admin/assignments",
        icon: ClipboardCheck,
      },
    ],
  },
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
  admin: {
    navItems: adminNavItems,
    portalLabel: "Admin Panel",
    settingsHref: "/admin/settings",
    roleLabel: "Admin",
  },
};

/* ── Collapsible nav group ─────────────────────────────── */
function NavGroupItem({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const isChildActive = group.children.some(
    (child) =>
      pathname === child.href || pathname?.startsWith(child.href + "/"),
  );

  const [open, setOpen] = useState(isChildActive);

  // Keep group open when navigating to a child route
  useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [isChildActive]);

  return (
    <div>
      {/* Group toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isChildActive
            ? "bg-primary/10 text-primary-dark"
            : "text-muted hover:bg-background hover:text-primary-dark"
        }`}
      >
        <group.icon
          className={`w-[18px] h-[18px] ${isChildActive ? "text-primary" : ""}`}
        />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Collapsible children */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="ml-3 pl-3 border-l-2 border-secondary/40 mt-1 space-y-0.5">
          {group.children.map((child) => {
            const isActive =
              pathname === child.href || pathname?.startsWith(child.href + "/");
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary-dark"
                    : "text-muted hover:bg-background hover:text-primary-dark"
                }`}
              >
                <child.icon
                  className={`w-4 h-4 ${isActive ? "text-primary" : ""}`}
                />
                {child.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Settings expandable with links ────────────────────── */
function SettingsExpander({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  const isChangePasswordActive = pathname === "/change-password";

  useEffect(() => {
    if (isChangePasswordActive) setOpen(true);
  }, [isChangePasswordActive]);

  return (
    <div>
      {/* Collapsible options — expand upward */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="ml-3 pl-3 border-l-2 border-secondary/40 mb-1 space-y-0.5">
          <Link
            href="/change-password"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
              isChangePasswordActive
                ? "bg-primary/10 text-primary-dark"
                : "text-muted hover:bg-background hover:text-primary-dark"
            }`}
          >
            <KeyRound
              className={`w-4 h-4 ${isChangePasswordActive ? "text-primary" : ""}`}
            />
            Change Password
          </Link>
        </div>
      </div>

      {/* Settings toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          open || isChangePasswordActive
            ? "bg-primary/10 text-primary-dark"
            : "text-muted hover:bg-background hover:text-primary-dark"
        }`}
      >
        <Settings className="w-[18px] h-[18px]" />
        <span className="flex-1 text-left">Settings</span>
        <ChevronUp
          className={`w-4 h-4 transition-transform duration-200 ${
            open ? "" : "rotate-180"
          }`}
        />
      </button>
    </div>
  );
}

interface SidebarProps {
  role: "teacher" | "student" | "admin";
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
        {config.navItems.map((entry) => {
          if (isNavGroup(entry)) {
            return (
              <NavGroupItem
                key={entry.label}
                group={entry}
                pathname={pathname}
              />
            );
          }

          const item = entry;
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
        <SettingsExpander pathname={pathname} />
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Log Out
        </button>

        {/* User pill */}
        <Link
          href={
            role === "student"
              ? "/student/profile"
              : role === "admin"
                ? "/admin/dashboard"
                : "/teacher/profile"
          }
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
