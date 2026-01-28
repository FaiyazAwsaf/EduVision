/**
 * AI Content Request System - Content Generation Page
 *
 * Page that orchestrates the content request workflow:
 * 1. User submits request via form
 * 2. System polls for status updates
 * 3. Displays generated content when ready
 */

"use client";

import { useState } from "react";
import { BookOpen, Home } from "lucide-react";
import ContentRequestForm from "@/components/content/ContentRequestForm";
import RequestStatusComponent from "@/components/content/RequestStatus";
import Link from "next/link";

type ViewState = "form" | "status";

export default function ContentPage() {
  const [viewState, setViewState] = useState<ViewState>("form");
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  const handleRequestCreated = (requestId: string) => {
    setCurrentRequestId(requestId);
    setViewState("status");
  };

  const handleCreateNew = () => {
    setCurrentRequestId(null);
    setViewState("form");
  };

  return (
    <div className="min-h-screen bg-[#F2EFE7]">
      {/* Header */}
      <header className="bg-white border-b border-[#9ACBD0]">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-[#006A71]">
                AI Content Generator
              </h1>
              <p className="mt-1 text-sm text-[#48A6A7]">
                Generate educational content powered by AI
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-[#48A6A7] hover:text-[#006A71] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Home className="w-4 h-4" /> Home
              </Link>
              <Link
                href="/study-plans"
                className="bg-[#48A6A7] text-white px-4 py-2 rounded-md hover:bg-[#006A71] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" /> Study Plans
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg border border-[#9ACBD0] p-6">
          {viewState === "form" ? (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-[#006A71]">
                  Create Content Request
                </h2>
                <p className="mt-1 text-sm text-[#48A6A7]">
                  Fill in the details below to generate AI-powered educational
                  content.
                </p>
              </div>
              <ContentRequestForm onSuccess={handleRequestCreated} />
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
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#9ACBD0] bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-[#48A6A7]">
            EduVision Platform - AI-Assisted Content Request System
          </p>
        </div>
      </footer>
    </div>
  );
}
