"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Mail,
  MapPin,
  Phone,
  Calendar,
  Briefcase,
  GraduationCap,
  Hash,
  BookOpen,
  Users,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import { getTeacherProfile, type TeacherProfile } from "@/api/school";

export default function TeacherProfilePage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth + role guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace(
        user?.role === "student" ? "/student/dashboard" : "/signin",
      );
    }
  }, [isReady, isAuthenticated, user, router]);

  // Fetch profile
  useEffect(() => {
    if (!user) return;

    async function fetchProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTeacherProfile(user!.id);
        setProfile(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load profile. Your profile may not be set up yet.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  if (!isReady || !isAuthenticated || !user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="teacher" />

      <main className="flex-1 ml-60 p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted hover:text-primary-dark transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-primary-dark">My Profile</h1>
          <p className="text-sm text-muted mt-1">
            Your personal and professional information
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Could not load profile
              </p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Profile Content */}
        {profile && !isLoading && (
          <div className="space-y-6 max-w-4xl">
            {/* Identity Card */}
            <div className="bg-white rounded-2xl border border-secondary/40 overflow-hidden">
              <div className="bg-linear-to-r from-primary to-primary-dark px-6 py-8">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {profile.first_name[0]}
                    {profile.last_name[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {profile.first_name} {profile.last_name}
                    </h2>
                    <p className="text-white/80 text-sm mt-1">
                      {profile.department || "Department not set"}
                    </p>
                    <p className="text-white/70 text-sm mt-0.5">
                      Employee ID: {profile.employee_id || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="bg-white rounded-2xl border border-secondary/40 p-6">
                <h3 className="text-base font-semibold text-primary-dark mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <InfoRow icon={Mail} label="Email" value={profile.email} />
                  <InfoRow
                    icon={Calendar}
                    label="Date of Birth"
                    value={
                      profile.date_of_birth
                        ? formatDate(profile.date_of_birth)
                        : "Not set"
                    }
                  />
                  <InfoRow
                    icon={Phone}
                    label="Phone"
                    value={profile.phone || "Not set"}
                  />
                  <InfoRow
                    icon={MapPin}
                    label="Address"
                    value={profile.address || "Not set"}
                  />
                </div>
              </div>

              {/* Professional Information */}
              <div className="bg-white rounded-2xl border border-secondary/40 p-6">
                <h3 className="text-base font-semibold text-primary-dark mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Professional Information
                </h3>
                <div className="space-y-4">
                  <InfoRow
                    icon={Hash}
                    label="Employee ID"
                    value={profile.employee_id || "Not set"}
                  />
                  <InfoRow
                    icon={BookOpen}
                    label="Department"
                    value={profile.department || "Not set"}
                  />
                  <InfoRow
                    icon={GraduationCap}
                    label="Qualification"
                    value={profile.qualification || "Not set"}
                  />
                </div>
              </div>

              {/* Class Teacher Assignment */}
              <div className="bg-white rounded-2xl border border-secondary/40 p-6 lg:col-span-2">
                <h3 className="text-base font-semibold text-primary-dark mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Class Teacher Assignment
                </h3>
                {profile.class_teacher_of_detail ? (
                  <div className="bg-background rounded-xl p-5 inline-flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-dark">
                        Class {profile.class_teacher_of_detail.class_name}
                        {profile.class_teacher_of_detail.stream &&
                          ` — ${profile.class_teacher_of_detail.stream}`}
                        , Section {profile.class_teacher_of_detail.name}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {profile.class_teacher_of_detail.academic_year} &middot;
                        Capacity: {profile.class_teacher_of_detail.capacity}{" "}
                        students
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Not currently assigned as a class teacher.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-primary-dark wrap-break-word">
          {value}
        </p>
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
