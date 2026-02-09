"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect based on role
  useEffect(() => {
    if (isReady && isAuthenticated && user) {
      if (user.role === "teacher") {
        router.replace("/teacher/dashboard");
      } else if (user.role === "student") {
        router.replace("/student/dashboard");
      } else {
        router.replace("/");
      }
    }
  }, [isReady, isAuthenticated, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const user = await login({ email: email.trim(), password });

      // Redirect based on user role
      if (user.role === "teacher") {
        router.replace("/teacher/dashboard");
      } else if (user.role === "student") {
        router.replace("/student/dashboard");
      } else {
        // Fallback to homepage if role is unexpected
        router.replace("/");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Don't flash the form if we're still checking auth state
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#F2EFE7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#48A6A7] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F2EFE7] to-[#E8F4F5] flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#48A6A7] to-[#006A71] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
            <BookOpen className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            EDUVISION
          </h1>
          <p className="text-xl text-white/90 text-center max-w-md font-light">
            Empowering students through intelligent tutoring and personalized
            learning
          </p>
        </div>
      </div>

      {/* Right side - Sign in form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Back button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#48A6A7] hover:text-[#006A71] mb-8 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </Link>

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#48A6A7] rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#006A71] mb-2">Sign In</h2>
            <p className="text-[#48A6A7] font-light">
              Welcome back to your learning journey
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#006A71] mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full rounded-xl border border-[#9ACBD0] bg-white px-4 py-3 pr-11 text-[#006A71] placeholder:text-[#9ACBD0] focus:outline-none focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent transition shadow-sm"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#48A6A7]" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#006A71] mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-[#9ACBD0] bg-white px-4 py-3 pr-11 text-[#006A71] placeholder:text-[#9ACBD0] focus:outline-none focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent transition shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#48A6A7] hover:text-[#006A71] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="mt-2 text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[#48A6A7] hover:text-[#006A71] font-medium transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#48A6A7] px-4 py-3 text-base font-semibold text-white hover:bg-[#006A71] focus:outline-none focus:ring-2 focus:ring-[#48A6A7] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#9ACBD0]"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gradient-to-br from-[#F2EFE7] to-[#E8F4F5] px-4 text-[#9ACBD0] font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-[#9ACBD0] bg-white px-4 py-3 text-base font-medium text-[#006A71] hover:bg-[#F2EFE7] focus:outline-none focus:ring-2 focus:ring-[#48A6A7] focus:ring-offset-2 transition-all shadow-sm hover:shadow"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          </form>

          {/* Sign up link */}
          <p className="mt-8 text-center text-sm text-[#006A71]">
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#48A6A7] hover:text-[#006A71] transition-colors"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
