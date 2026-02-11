/**
 * AI Content Request System - Content Generation Page
 *
 * Page that orchestrates the content request workflow:
 * 1. User submits request via form
 * 2. System polls for status updates
 * 3. Displays generated content when ready
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, History } from "lucide-react";
import ContentRequestForm from "@/components/content/ContentRequestForm";
import RequestStatusComponent from "@/components/content/RequestStatus";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";

type ViewState = "form" | "status";

export default function ContentPage() {
  const { isReady, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>("form");
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, router]);

  if (!isReady || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  const handleRequestCreated = (requestId: string) => {
    setCurrentRequestId(requestId);
    setViewState("status");
  };

  const handleCreateNew = () => {
    setCurrentRequestId(null);
    setViewState("form");
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={user.role} />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                AI Content Generator
              </h1>
              <p className="text-sm text-primary">
                Generate educational content powered by AI
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/content/history"
                className="text-primary hover:text-primary-dark transition-colors text-sm font-medium flex items-center gap-2"
              >
                <History className="w-4 h-4" /> History
              </Link>
              <Link
                href="/study-plans"
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" /> Study Plans
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-8 py-8">
          <div className="max-w-4xl">
            <div className="bg-white rounded-lg border border-secondary p-6">
              {viewState === "form" ? (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-primary-dark">
                      Create Content Request
                    </h2>
                    <p className="mt-1 text-sm text-primary">
                      Fill in the details below to generate AI-powered educational
                      content.
                    </p>
                  </div>
                  <ContentRequestForm
                    onSuccess={handleRequestCreated}
                    userRole={user?.role as "student" | "teacher" | undefined}
                  />
                </div>
              ) : currentRequestId ? (
                <div>
                  <RequestStatusComponent
                    requestId={currentRequestId}
                    onCreateNew={handleCreateNew}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
