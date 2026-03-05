/**
 * Whiteboard Page
 *
 * Entry point for the collaborative whiteboard
 * Extracts session/user info from URL params or generates defaults
 */

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useEffect } from "react";
import Whiteboard from "@/components/whiteboard/Whiteboard";

function WhiteboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Extract params from URL or use defaults (only on client side)
  const sessionId = useMemo(() => {
    if (!isClient) return "loading";
    return searchParams.get("session") || `session-${Date.now()}`;
  }, [searchParams, isClient]);

  const userId = useMemo(() => {
    if (!isClient) return "loading";
    return (
      searchParams.get("userId") ||
      `user-${Math.random().toString(36).substr(2, 9)}`
    );
  }, [searchParams, isClient]);

  const role = useMemo(() => {
    const roleParam = searchParams.get("role");
    return roleParam === "teacher" || roleParam === "student"
      ? roleParam
      : "teacher";
  }, [searchParams]);

  // Don't render whiteboard until we're on client side
  if (!isClient || sessionId === "loading" || userId === "loading") {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          color: "#fff",
          fontSize: "18px",
        }}
      >
        Initializing whiteboard...
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {/* Back Button */}
      <button
        onClick={() => router.push("/teacher/dashboard")}
        style={{
          position: "fixed",
          top: 10,
          right: 150,
          zIndex: 1001,
          padding: "8px 16px",
          backgroundColor: "#48A6A7",
          color: "#F2EFE7",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          transition: "background-color 0.2s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#006A71")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#48A6A7")}
      >
        ← Back to Home
      </button>
      <Whiteboard sessionId={sessionId} userId={userId} role={role} />
    </div>
  );
}

export default function WhiteboardPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a1a",
            color: "#fff",
            fontSize: "18px",
          }}
        >
          Loading whiteboard...
        </div>
      }
    >
      <WhiteboardContent />
    </Suspense>
  );
}
