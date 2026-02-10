"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  BookOpen,
  MapPin,
  Phone,
  Mail,
  Droplets,
  Calendar,
  Hash,
  GraduationCap,
  Users,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import { getStudentProfile, type StudentProfile } from "@/api/school";

export default function StudentProfilePage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "student") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Fetch profile
  useEffect(() => {
    if (!user) return;

    async function fetchProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getStudentProfile(user!.id);
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
      <Sidebar role="student" />

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
            Your personal and academic information
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
              <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-8">
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
                      Roll No: {profile.roll_number}
                    </p>
                    {profile.section_detail && (
                      <p className="text-white/70 text-sm mt-0.5">
                        Class {profile.section_detail.class_name}
                        {profile.section_detail.stream &&
                          ` - ${profile.section_detail.stream}`}
                        , Section {profile.section_detail.name} &middot;{" "}
                        {profile.section_detail.academic_year}
                      </p>
                    )}
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
                    icon={Droplets}
                    label="Blood Group"
                    value={profile.blood_group || "Not set"}
                  />
                  <InfoRow
                    icon={MapPin}
                    label="Address"
                    value={profile.address || "Not set"}
                  />
                </div>
              </div>

              {/* Academic Information */}
              <div className="bg-white rounded-2xl border border-secondary/40 p-6">
                <h3 className="text-base font-semibold text-primary-dark mb-4 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Academic Information
                </h3>
                <div className="space-y-4">
                  <InfoRow
                    icon={Hash}
                    label="Roll Number"
                    value={profile.roll_number}
                  />
                  <InfoRow
                    icon={BookOpen}
                    label="Class"
                    value={
                      profile.section_detail
                        ? `${profile.section_detail.class_name}${profile.section_detail.stream ? ` - ${profile.section_detail.stream}` : ""}`
                        : "Not assigned"
                    }
                  />
                  <InfoRow
                    icon={Users}
                    label="Section"
                    value={
                      profile.section_detail
                        ? profile.section_detail.name
                        : "Not assigned"
                    }
                  />
                  <InfoRow
                    icon={Calendar}
                    label="Academic Year"
                    value={
                      profile.section_detail
                        ? profile.section_detail.academic_year
                        : "—"
                    }
                  />
                </div>
              </div>

              {/* Parent / Guardian Information */}
              <div className="bg-white rounded-2xl border border-secondary/40 p-6 lg:col-span-2">
                <h3 className="text-base font-semibold text-primary-dark mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Parent / Guardian Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profile.father_name && (
                    <ContactCard
                      label="Father"
                      name={profile.father_name}
                      phone={profile.father_phone}
                    />
                  )}
                  {profile.mother_name && (
                    <ContactCard
                      label="Mother"
                      name={profile.mother_name}
                      phone={profile.mother_phone}
                    />
                  )}
                  {profile.guardian_name && (
                    <ContactCard
                      label="Guardian"
                      name={profile.guardian_name}
                      phone={profile.guardian_phone}
                    />
                  )}
                  {!profile.father_name &&
                    !profile.mother_name &&
                    !profile.guardian_name && (
                      <p className="text-sm text-muted col-span-full">
                        No parent/guardian information on file.
                      </p>
                    )}
                </div>
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
        <p className="text-sm font-medium text-primary-dark break-words">
          {value}
        </p>
      </div>
    </div>
  );
}

function ContactCard({
  label,
  name,
  phone,
}: {
  label: string;
  name: string;
  phone: string;
}) {
  return (
    <div className="bg-background rounded-xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-sm font-semibold text-primary-dark">{name}</p>
      {phone && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <Phone className="w-3 h-3 text-muted" />
          <p className="text-xs text-muted">{phone}</p>
        </div>
      )}
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
