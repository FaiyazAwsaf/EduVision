/**
 * Content History Detail Page
 *
 * Shows a single content request with its status and generated content.
 * Provides a regenerate button for completed or failed requests.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { regenerateContentRequest } from "@/api/contentRequests";
import RequestStatusComponent from "@/components/content/RequestStatus";
import Sidebar from "@/components/shared/Sidebar";

export default function ContentHistoryDetailPage() {
  const { isReady, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;

  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

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

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenerateError(null);
    try {
      const newRequest = await regenerateContentRequest(requestId);
      // Navigate to the new request's detail page
      router.push(`/content/history/${newRequest.id}`);
    } catch (err) {
      setRegenerateError(
        err instanceof Error ? err.message : "Failed to regenerate",
      );
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={user.role} />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/content/history"
                className="text-primary hover:text-primary-dark transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-primary-dark">
                  {user.role === "teacher"
                    ? "Content Details"
                    : "Study Material"}
                </h1>
                <p className="text-sm text-primary">
                  ID: {requestId.slice(0, 8)}...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium disabled:opacity-50"
              >
                {regenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Regenerate
              </button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-8 py-8">
          <div className="max-w-4xl">
            {regenerateError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
                {regenerateError}
              </div>
            )}

            <div className="bg-white rounded-lg border border-secondary p-6">
              <RequestStatusComponent
                requestId={requestId}
                onCreateNew={() => router.push("/content")}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
