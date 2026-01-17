/**
 * EduVision AI - Homepage
 *
 * A minimalistic landing page showcasing the platform's key features
 * and providing navigation to the main modules.
 */

import Link from "next/link";
import {
  Sparkles,
  Video,
  BookOpen,
  Brain,
  FileText,
  ClipboardCheck,
  PenTool,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F2EFE7] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#9ACBD0]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#006A71] rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#006A71]">
                EduVision AI
              </h1>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/study-plans"
                className="text-[#48A6A7] hover:text-[#006A71] transition-colors text-sm font-medium"
              >
                Study Plans
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#006A71] mb-4">
              AI-Powered Education Platform
            </h2>
            <p className="text-lg text-[#48A6A7] max-w-2xl mx-auto">
              Empowering teachers and students with intelligent tools for
              personalized learning and interactive tutoring.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Content Generation Card */}
            <Link href="/content" className="group">
              <div className="bg-white rounded-xl border border-[#9ACBD0] p-8 h-full transition-all duration-200 hover:border-[#48A6A7] hover:shadow-lg group-hover:-translate-y-1">
                <div className="w-14 h-14 bg-[#F2EFE7] rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#9ACBD0]/20 transition-colors">
                  <Sparkles className="w-7 h-7 text-[#006A71]" />
                </div>
                <h3 className="text-xl font-semibold text-[#006A71] mb-3">
                  AI Content Generator
                </h3>
                <p className="text-[#48A6A7] text-sm leading-relaxed mb-4">
                  Generate personalized educational content including topic
                  summaries, concept explanations, formula sheets, and study
                  plans powered by AI.
                </p>
                <span className="inline-flex items-center text-sm font-medium text-[#48A6A7] group-hover:text-[#006A71] transition-colors">
                  Start generating →
                </span>
              </div>
            </Link>

            {/* Live Tutoring Card */}
            <Link href="/teacher/dashboard" className="group">
              <div className="bg-white rounded-xl border border-[#9ACBD0] p-8 h-full transition-all duration-200 hover:border-[#48A6A7] hover:shadow-lg group-hover:-translate-y-1">
                <div className="w-14 h-14 bg-[#F2EFE7] rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#9ACBD0]/20 transition-colors">
                  <Video className="w-7 h-7 text-[#006A71]" />
                </div>
                <h3 className="text-xl font-semibold text-[#006A71] mb-3">
                  Live Tutoring Room
                </h3>
                <p className="text-[#48A6A7] text-sm leading-relaxed mb-4">
                  One-on-one interactive tutoring sessions with dual whiteboard
                  system, video conferencing, screen sharing, and AI-powered
                  monitoring.
                </p>
                <span className="inline-flex items-center text-sm font-medium text-[#48A6A7] group-hover:text-[#006A71] transition-colors">
                  Open dashboard →
                </span>
              </div>
            </Link>

            {/* Script Evaluation Card */}
            <Link href="/evaluation" className="group">
              <div className="bg-white rounded-xl border border-[#9ACBD0] p-8 h-full transition-all duration-200 hover:border-[#48A6A7] hover:shadow-lg group-hover:-translate-y-1">
                <div className="w-14 h-14 bg-[#F2EFE7] rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#9ACBD0]/20 transition-colors">
                  <ClipboardCheck className="w-7 h-7 text-[#006A71]" />
                </div>
                <h3 className="text-xl font-semibold text-[#006A71] mb-3">
                  Script Evaluation
                </h3>
                <p className="text-[#48A6A7] text-sm leading-relaxed mb-4">
                  Upload and evaluate handwritten answer scripts using
                  AI-powered grading. Supports question papers, marking schemes,
                  and detailed evaluation reports.
                </p>
                <span className="inline-flex items-center text-sm font-medium text-[#48A6A7] group-hover:text-[#006A71] transition-colors">
                  Start evaluating →
                </span>
              </div>
            </Link>

            {/* Rubric Builder Card */}
            <Link href="/rubrics" className="group">
              <div className="bg-white rounded-xl border border-[#9ACBD0] p-8 h-full transition-all duration-200 hover:border-[#48A6A7] hover:shadow-lg group-hover:-translate-y-1">
                <div className="w-14 h-14 bg-[#F2EFE7] rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#9ACBD0]/20 transition-colors">
                  <FileText className="w-7 h-7 text-[#006A71]" />
                </div>
                <h3 className="text-xl font-semibold text-[#006A71] mb-3">
                  Rubric Builder
                </h3>
                <p className="text-[#48A6A7] text-sm leading-relaxed mb-4">
                  Create detailed evaluation rubrics with multiple rule types,
                  keyword matching, and configurable scoring modes for
                  consistent automated grading.
                </p>
                <span className="inline-flex items-center text-sm font-medium text-[#48A6A7] group-hover:text-[#006A71] transition-colors">
                  Build rubrics →
                </span>
              </div>
            </Link>

            {/* Whiteboard Card */}
            <Link href="/whiteboard" className="group">
              <div className="bg-white rounded-xl border border-[#9ACBD0] p-8 h-full transition-all duration-200 hover:border-[#48A6A7] hover:shadow-lg group-hover:-translate-y-1">
                <div className="w-14 h-14 bg-[#F2EFE7] rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#9ACBD0]/20 transition-colors">
                  <PenTool className="w-7 h-7 text-[#006A71]" />
                </div>
                <h3 className="text-xl font-semibold text-[#006A71] mb-3">
                  Interactive Whiteboard
                </h3>
                <p className="text-[#48A6A7] text-sm leading-relaxed mb-4">
                  Digital whiteboard for teaching and learning with drawing
                  tools, eraser, and real-time collaboration capabilities for
                  interactive sessions.
                </p>
                <span className="inline-flex items-center text-sm font-medium text-[#48A6A7] group-hover:text-[#006A71] transition-colors">
                  Open whiteboard →
                </span>
              </div>
            </Link>
          </div>

          {/* Additional Quick Links */}
          <div className="mt-12 text-center">
            <p className="text-sm text-[#9ACBD0] mb-4">More features</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Link
                href="/study-plans"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#9ACBD0] rounded-lg text-sm text-[#48A6A7] hover:border-[#48A6A7] hover:text-[#006A71] transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Study Plans
              </Link>
              <Link
                href="/evaluation"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#9ACBD0] rounded-lg text-sm text-[#48A6A7] hover:border-[#48A6A7] hover:text-[#006A71] transition-colors"
              >
                <ClipboardCheck className="w-4 h-4" />
                Evaluation
              </Link>
              <Link
                href="/rubrics"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#9ACBD0] rounded-lg text-sm text-[#48A6A7] hover:border-[#48A6A7] hover:text-[#006A71] transition-colors"
              >
                <FileText className="w-4 h-4" />
                Rubrics
              </Link>
              <Link
                href="/whiteboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#9ACBD0] rounded-lg text-sm text-[#48A6A7] hover:border-[#48A6A7] hover:text-[#006A71] transition-colors"
              >
                <PenTool className="w-4 h-4" />
                Whiteboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#9ACBD0] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-[#48A6A7]">
            EduVision AI Platform - Intelligent Education Tools
          </p>
        </div>
      </footer>
    </div>
  );
}
