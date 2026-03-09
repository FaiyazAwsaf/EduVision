/**
 * EduVision AI - Landing Page
 *
 * Public-facing homepage showcasing the platform's key features
 * for teachers and students, with a call-to-action to sign in.
 */

import Link from "next/link";
import {
  Video,
  BookOpen,
  Brain,
  FileText,
  ClipboardCheck,
  PenTool,
  Sparkles,
  GraduationCap,
  BarChart3,
  ArrowRight,
  Monitor,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-dark rounded-xl flex items-center justify-center shadow-md">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-primary-dark">
              EduVision
            </span>
          </div>
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors shadow-sm"
          >
            Sign In
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold text-primary-dark leading-tight mb-6">
          Smarter Teaching,
          <br />
          Personalized Learning
        </h1>
        <p className="text-lg text-primary max-w-2xl mx-auto mb-10 leading-relaxed">
          EduVision combines live tutoring, automated script evaluation, AI
          content generation, and real-time analytics into one seamless platform
          — empowering teachers and students alike.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 px-7 py-3 bg-primary-dark text-white text-sm font-semibold rounded-xl hover:bg-[#004D52] transition-colors shadow-lg shadow-primary-dark/20"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 px-7 py-3 border border-secondary text-primary-dark text-sm font-semibold rounded-xl hover:bg-white transition-colors"
          >
            Explore Features
          </a>
        </div>
      </section>

      {/* ── Role cards ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Teacher card */}
          <div className="bg-white rounded-2xl border border-secondary/40 p-8 shadow-sm">
            <div className="w-12 h-12 bg-primary-dark/10 rounded-xl flex items-center justify-center mb-4">
              <GraduationCap className="w-6 h-6 text-primary-dark" />
            </div>
            <h3 className="text-lg font-semibold text-primary-dark mb-2">
              For Teachers
            </h3>
            <p className="text-sm text-primary leading-relaxed">
              Create tutoring sessions, build rubrics, auto-evaluate answer
              scripts, generate teaching content, and gain insights into student
              performance — all from one dashboard.
            </p>
          </div>

          {/* Student card */}
          <div className="bg-white rounded-2xl border border-secondary/40 p-8 shadow-sm">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary-dark mb-2">
              For Students
            </h3>
            <p className="text-sm text-primary leading-relaxed">
              Join live tutoring sessions with video, audio, and an interactive
              whiteboard. Access personalized content, request study materials,
              and view your analytics.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section
        id="features"
        className="bg-white border-y border-secondary/30 py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-primary-dark mb-3">
              Everything You Need
            </h2>
            <p className="text-primary max-w-lg mx-auto">
              A comprehensive suite of tools designed for modern education
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-secondary/40 p-6 hover:border-primary transition-colors">
              <div className="w-11 h-11 bg-primary-dark/10 rounded-xl flex items-center justify-center mb-4">
                <Video className="w-5 h-5 text-primary-dark" />
              </div>
              <h3 className="font-semibold text-primary-dark mb-2">
                Live Tutoring
              </h3>
              <p className="text-sm text-primary leading-relaxed">
                One-on-one sessions with HD video, audio, screen sharing, and a
                dual interactive whiteboard for seamless teaching.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-secondary/40 p-6 hover:border-primary transition-colors">
              <div className="w-11 h-11 bg-primary-dark/10 rounded-xl flex items-center justify-center mb-4">
                <ClipboardCheck className="w-5 h-5 text-primary-dark" />
              </div>
              <h3 className="font-semibold text-primary-dark mb-2">
                Script Evaluation
              </h3>
              <p className="text-sm text-primary leading-relaxed">
                Upload handwritten answer scripts and let AI grade them
                automatically using your custom rubrics and marking schemes.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-secondary/40 p-6 hover:border-primary transition-colors">
              <div className="w-11 h-11 bg-primary-dark/10 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-primary-dark" />
              </div>
              <h3 className="font-semibold text-primary-dark mb-2">
                Rubric Builder
              </h3>
              <p className="text-sm text-primary leading-relaxed">
                Design detailed evaluation rubrics with multiple rule types,
                keyword matching, and configurable scoring for consistent
                grading.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border border-secondary/40 p-6 hover:border-primary transition-colors">
              <div className="w-11 h-11 bg-primary-dark/10 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-primary-dark" />
              </div>
              <h3 className="font-semibold text-primary-dark mb-2">
                AI Content Generation
              </h3>
              <p className="text-sm text-primary leading-relaxed">
                Generate topic summaries, concept explanations, formula sheets,
                and personalized study plans powered by advanced AI models.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-2xl border border-secondary/40 p-6 hover:border-primary transition-colors">
              <div className="w-11 h-11 bg-primary-dark/10 rounded-xl flex items-center justify-center mb-4">
                <PenTool className="w-5 h-5 text-primary-dark" />
              </div>
              <h3 className="font-semibold text-primary-dark mb-2">
                Interactive Whiteboard
              </h3>
              <p className="text-sm text-primary leading-relaxed">
                A shared digital canvas with drawing tools, text, and real-time
                collaboration — perfect for explaining concepts visually.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-2xl border border-secondary/40 p-6 hover:border-primary transition-colors">
              <div className="w-11 h-11 bg-primary-dark/10 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5 text-primary-dark" />
              </div>
              <h3 className="font-semibold text-primary-dark mb-2">
                Analytics &amp; Insights
              </h3>
              <p className="text-sm text-primary leading-relaxed">
                Track student progress, view performance trends, and receive
                AI-generated insights to personalise teaching strategies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-secondary/30 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">EduVision</span>
          </div>
          <p className="text-xs text-secondary">
            &copy; {new Date().getFullYear()} EduVision AI Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
