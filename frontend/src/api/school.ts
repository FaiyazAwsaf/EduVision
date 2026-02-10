/**
 * School API Client
 *
 * Handles fetching school-related data: student profiles, teacher profiles,
 * classes, and sections.
 */

import { API_BASE_URL, parseApiError } from "@/api/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionDetail {
  id: number;
  name: string;
  class_name: string;
  stream: string;
  academic_year: string;
  capacity: number;
}

export interface StudentProfile {
  user_id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  section: number | null;
  section_detail: SectionDetail | null;
  blood_group: string;
  date_of_birth: string | null;
  address: string;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  guardian_name: string;
  guardian_phone: string;
  created_at: string;
  updated_at: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const SCHOOL_URL = `${API_BASE_URL}/school`;

async function schoolFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${SCHOOL_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await parseApiError(
      response,
      `API Error: ${response.status}`,
    );
    throw new Error(message);
  }

  return response.json();
}

// ─── Student Profile ─────────────────────────────────────────────────────────

export async function getStudentProfile(
  userId: string,
): Promise<StudentProfile> {
  return schoolFetch<StudentProfile>(`/students/${userId}/`);
}
