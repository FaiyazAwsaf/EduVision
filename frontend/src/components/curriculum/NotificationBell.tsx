"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Check, X } from "lucide-react";
import { getNotifications, markNotificationsRead } from "@/api/curriculum";
import type { TeacherNotification } from "@/types/curriculum";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch {
      // silent
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead(undefined, true);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silent
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationsRead([id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {
      // silent
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 rounded-lg text-muted hover:text-primary-dark hover:bg-background transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl border border-secondary/30 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-secondary/20">
            <h3 className="text-sm font-semibold text-primary-dark">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">
                No notifications yet.
              </div>
            ) : (
              notifications.slice(0, 15).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-secondary/10 last:border-0 ${
                    !n.is_read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="p-1.5 bg-red-50 rounded-lg shrink-0 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary-dark leading-snug">
                      {n.message}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {n.course_title} &middot; {n.percentage.toFixed(0)}% of
                      students
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 p-1 text-muted hover:text-green-600 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-secondary/20 text-center">
              <Link
                href="/teacher/curriculum/difficulty"
                className="text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                View Difficulty Reports
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
